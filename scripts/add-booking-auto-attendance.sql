-- ================================================================
-- 예약 출결 자동 처리 (2026-09-30 클라이언트: 예약 출결 미처리 누적)
--
-- 스펙 변경: 종전 "자동 참석 처리는 어디에도 없다"(명세 13.3)를 폐기한다.
--   미처리(pending)로 남은 확정 예약을 아래 규칙으로 자동 판정한다.
--
--   [자동 참석] 예약 상담기록(booking_records)이 있거나, 같은 학생·같은 날짜에
--     슬롯 강사 본인이 쓴 상담보고·수업보고가 있으면 참석.
--     그날 같은 강사 예약이 여러 건이면 기록 시간과 겹치는 건만,
--     기록에 시간이 없으면 전부.
--   [자동 미참석] 상담일이 지난 뒤(익일 새벽), 참석 근거가 없고
--     R1 그날 센터 출결이 결석(등원 기록 없음)이거나
--     R2 등·하원 기록이 온전한데 예약 시간(±여유분)이 재실 구간과 전혀 겹치지 않으면 미참석.
--     출결 행이 없거나 미하원 등 재실 구간을 확정할 수 없으면 건너뛴다(pending 유지).
--   [미채택] "다른 과목 기록과 시간 중복 → 미참석"은 넣지 않았다 — 상담기록에
--     과목 필드가 없고 시간이 선택 입력이라 오판 위험이 크다.
--
--   공통: status='confirmed' AND attendance_status='pending' AND attendance_marked_by IS NULL
--     만 대상이다. 사람이 한 번이라도 처리한 건(pending 으로 되돌린 건 포함)은 건드리지 않는다.
--     자동 처리분은 attendance_marked_by='system', attendance_note='[자동] …' 로 구분하며
--     담당 강사·관리자가 booking_set_attendance 로 그대로 정정할 수 있다.
--
-- 구성: 판정은 booking_auto_attendance_plan (순수 SELECT — 미리보기와 실행이 같은 로직),
--   적용은 _booking_apply_auto_attendance, 진입점은 야간 일괄 booking_auto_attendance 와
--   기록 저장 직후 즉시 반영용 booking_sync_attendance_from_records (참석 전용).
--   cron 등록은 add-booking-auto-attendance-cron.sql (신 프런트 배포 후 적용).
--
-- 이 파일은 함수만 만든다 — 적용만으로는 아무 데이터도 바뀌지 않는다(구 프런트 호환).
-- booking_daily_digest 를 재정의한다(원본: add-booking-system.sql). 원본 파일을
-- 재실행하면 이 재정의가 되돌아가므로 이 파일을 다시 적용할 것.
-- CREATE OR REPLACE 멱등 — 재실행 안전.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. 내부 — 'HH:MM' 텍스트 → TIME (빈 값·형식 오류는 NULL)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION _booking_hhmm(p TEXT)
RETURNS TIME LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN p::time END;
$$;

-- ----------------------------------------------------------------
-- 2. 내부 — 재실 구간이 [p_from, p_to] 와 겹치는가.
--    TRUE/FALSE = 판정 가능, NULL = 재실 구간 확정 불가(미하원·기록 불완전).
--    events([{type:'in'|'out', at}], 재등원 누적)가 있으면 in→out 쌍으로,
--    없으면 check_in_at~check_out_at 한 구간으로 본다.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION _booking_presence_overlaps(
  p_events JSONB, p_in TIMESTAMPTZ, p_out TIMESTAMPTZ,
  p_from TIMESTAMPTZ, p_to TIMESTAMPTZ
) RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
DECLARE
  e     JSONB;
  v_in  TIMESTAMPTZ;
  v_at  TIMESTAMPTZ;
  v_any BOOLEAN := FALSE;
BEGIN
  IF p_events IS NULL OR jsonb_typeof(p_events) <> 'array' OR jsonb_array_length(p_events) = 0 THEN
    IF p_in IS NULL OR p_out IS NULL OR p_out < p_in THEN
      RETURN NULL;
    END IF;
    RETURN p_in < p_to AND p_out > p_from;
  END IF;

  FOR e IN SELECT value FROM jsonb_array_elements(p_events)
           ORDER BY (value->>'at')::timestamptz LOOP
    v_at := (e->>'at')::timestamptz;
    IF e->>'type' = 'in' THEN
      IF v_in IS NOT NULL THEN RETURN NULL; END IF;   -- 하원 없이 연속 등원
      v_in := v_at;
    ELSIF e->>'type' = 'out' THEN
      IF v_in IS NULL THEN RETURN NULL; END IF;       -- 등원 없는 하원
      IF v_in < p_to AND v_at > p_from THEN v_any := TRUE; END IF;
      v_in := NULL;
    ELSE
      RETURN NULL;
    END IF;
  END LOOP;
  IF v_in IS NOT NULL THEN RETURN NULL; END IF;       -- 미하원
  RETURN v_any;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;

-- ----------------------------------------------------------------
-- 3. 판정 계획 — 순수 SELECT. 미리보기(dry-run)로 그대로 쓸 수 있다.
--      SELECT rule, new_status, count(*)
--      FROM booking_auto_attendance_plan('2026-07-18', current_date, '2026-07-18') GROUP BY 1, 2;
--    p_absent_from 이 NULL 이면 참석 판정만 한다.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION booking_auto_attendance_plan(
  p_from DATE, p_to DATE, p_absent_from DATE DEFAULT NULL,
  p_student_ids TEXT[] DEFAULT NULL, p_grace_min INT DEFAULT 10
) RETURNS TABLE (
  reservation_id TEXT, student_id TEXT, educator_id TEXT, slot_date DATE,
  start_time TIME, end_time TIME, new_status TEXT, rule TEXT, reason TEXT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH base AS (
    SELECT res.id, res.student_id, s.educator_id, s.date, s.start_time, s.end_time,
           res.attendance_status, res.attendance_marked_by,
           -- 그날 같은 강사와 잡힌 확정 예약 수 (이미 처리된 건 포함 — 기록 1건이 여러 예약을 덮지 않게)
           count(*) OVER (PARTITION BY res.student_id, s.date, s.educator_id) AS n_same
    FROM booking_reservations res
    JOIN booking_slots s ON s.id = res.slot_id
    WHERE res.status = 'confirmed'
      AND s.date BETWEEN p_from AND p_to
      AND (p_student_ids IS NULL OR res.student_id = ANY (p_student_ids))
  ),
  cand AS (
    SELECT * FROM base b
    WHERE b.attendance_status = 'pending' AND b.attendance_marked_by IS NULL
      AND (b.date + b.start_time) <= (now() AT TIME ZONE 'Asia/Seoul')
  ),
  ev AS (
    SELECT cr.student_id, cr.manager_id AS author_id, cr.date,
           _booking_hhmm(cr.start_time) AS st, _booking_hhmm(cr.end_time) AS et,
           '상담보고'::text AS kind
    FROM counseling_records cr
    WHERE cr.date BETWEEN p_from AND p_to
    UNION ALL
    SELECT sid.value, lr.author_id, lr.date,
           _booking_hhmm(lr.start_time), _booking_hhmm(lr.end_time), '수업보고'
    FROM lesson_reports lr
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(lr.student_ids) = 'array' THEN lr.student_ids ELSE '[]'::jsonb END
    ) AS sid(value)
    WHERE lr.date BETWEEN p_from AND p_to
  ),
  judged AS (
    SELECT c.*,
      EXISTS (SELECT 1 FROM booking_records br WHERE br.reservation_id = c.id) AS has_record,
      (SELECT min(e.kind) FROM ev e
        WHERE e.student_id = c.student_id AND e.date = c.date AND e.author_id = c.educator_id
          AND (c.n_same = 1 OR e.st IS NULL OR e.et IS NULL
               OR (e.st < c.end_time AND e.et > c.start_time))) AS ev_kind,
      -- 같은 강사의 기록이 (시간 무관하게) 있으면 미참석 판정은 하지 않는다
      EXISTS (SELECT 1 FROM ev e
        WHERE e.student_id = c.student_id AND e.date = c.date
          AND e.author_id = c.educator_id) AS has_any_ev,
      ar.status AS ar_status, ar.check_in_at, ar.check_out_at,
      _booking_presence_overlaps(
        ar.events, ar.check_in_at, ar.check_out_at,
        ((c.date + c.start_time) AT TIME ZONE 'Asia/Seoul') - make_interval(mins => p_grace_min),
        ((c.date + c.end_time)   AT TIME ZONE 'Asia/Seoul') + make_interval(mins => p_grace_min)
      ) AS present
    FROM cand c
    LEFT JOIN attendance_records ar ON ar.student_id = c.student_id AND ar.date = c.date
  ),
  decided AS (
    SELECT j.*,
      CASE
        WHEN j.has_record THEN 'A1'
        WHEN j.ev_kind IS NOT NULL THEN 'A2'
        WHEN p_absent_from IS NULL OR j.date < p_absent_from
             OR j.date >= (now() AT TIME ZONE 'Asia/Seoul')::date
             OR j.has_any_ev THEN NULL
        WHEN j.ar_status = 'absent' AND j.check_in_at IS NULL THEN 'R1'
        WHEN j.present IS FALSE THEN 'R2'
      END AS rule
    FROM judged j
  )
  SELECT d.id, d.student_id, d.educator_id, d.date, d.start_time, d.end_time,
         CASE WHEN d.rule IN ('A1', 'A2') THEN 'attended' ELSE 'absent' END,
         d.rule,
         CASE d.rule
           WHEN 'A1' THEN '[자동] 예약 상담기록 작성 확인'
           WHEN 'A2' THEN '[자동] ' || d.ev_kind || ' 기록 확인'
           WHEN 'R1' THEN '[자동] 센터 결석일'
           WHEN 'R2' THEN '[자동] 센터 재실 '
                || to_char(d.check_in_at AT TIME ZONE 'Asia/Seoul', 'HH24:MI') || '~'
                || to_char(d.check_out_at AT TIME ZONE 'Asia/Seoul', 'HH24:MI') || ' 밖'
         END
  FROM decided d
  WHERE d.rule IS NOT NULL;
$$;

-- ----------------------------------------------------------------
-- 4. 내부 — 계획 적용. 행 잠금 후 "아직 미처리·미수기"인지 다시 확인해
--    수동 처리와의 경합에서 사람의 입력을 덮지 않는다.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION _booking_apply_auto_attendance(
  p_from DATE, p_to DATE, p_absent_from DATE, p_student_ids TEXT[],
  p_notify BOOLEAN, p_actor_id TEXT
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  pl         RECORD;
  res        booking_reservations%ROWTYPE;
  v_before   jsonb;
  v_attended INT := 0;
  v_absent   INT := 0;
BEGIN
  FOR pl IN
    SELECT p.*, bp.name AS program_name, u.name AS student_name
    FROM booking_auto_attendance_plan(p_from, p_to, p_absent_from, p_student_ids) p
    JOIN booking_reservations r ON r.id = p.reservation_id
    JOIN booking_programs bp ON bp.id = r.program_id
    JOIN users u ON u.id = p.student_id
    ORDER BY p.reservation_id
  LOOP
    SELECT * INTO res FROM booking_reservations WHERE id = pl.reservation_id FOR UPDATE;
    CONTINUE WHEN res.id IS NULL OR res.status <> 'confirmed'
      OR res.attendance_status <> 'pending' OR res.attendance_marked_by IS NOT NULL;
    v_before := to_jsonb(res);

    UPDATE booking_reservations
       SET attendance_status = pl.new_status,
           attendance_marked_by = 'system',
           attendance_marked_at = now(),
           attendance_note = pl.reason
     WHERE id = res.id
     RETURNING * INTO res;

    PERFORM _booking_audit('reservation', res.id,
      CASE WHEN pl.new_status = 'attended' THEN 'auto_attended' ELSE 'auto_absent' END,
      COALESCE(p_actor_id, 'system'), 'system', pl.reason, FALSE, v_before, to_jsonb(res));

    IF pl.new_status = 'attended' THEN
      v_attended := v_attended + 1;
    ELSE
      v_absent := v_absent + 1;
      IF p_notify AND pl.educator_id IS NOT NULL THEN
        PERFORM _booking_notify_once(pl.educator_id, 'attendance_auto', res.id,
          '[' || pl.program_name || '] ' || to_char(pl.slot_date, 'MM/DD') || ' ' || pl.student_name
          || ' 예약이 자동 미참석 처리되었습니다. ('
          || replace(pl.reason, '[자동] ', '') || ') 사실과 다르면 출결을 정정해 주세요.');
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'code', 'OK', 'attended', v_attended, 'absent', v_absent);
END $$;

-- ----------------------------------------------------------------
-- 5. 야간 일괄 (pg_cron KST 00:02 — 다이제스트 00:05 보다 먼저).
--    p_attend_days: 자동 참석을 거슬러 볼 일수 (늦게 쓴 기록 반영).
--    p_absent_days: 자동 미참석을 거슬러 볼 일수 (기본 1 = 어제분만, 0 = 미참석 판정 끔).
--    소급 1회 실행 예: SELECT booking_auto_attendance(120, 0, FALSE);
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION booking_auto_attendance(
  p_attend_days INT DEFAULT 60, p_absent_days INT DEFAULT 1, p_notify BOOLEAN DEFAULT TRUE
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  kst_date DATE := (now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  RETURN _booking_apply_auto_attendance(
    kst_date - GREATEST(p_attend_days, p_absent_days), kst_date,
    CASE WHEN p_absent_days > 0 THEN kst_date - p_absent_days END,
    NULL, p_notify, NULL);
END $$;

-- ----------------------------------------------------------------
-- 6. RPC — 상담보고·수업보고 저장 직후 즉시 반영 (참석 전용).
--    출결 값을 인자로 받지 않고 DB 의 기록 존재를 스스로 다시 확인하므로
--    호출만으로 출결을 임의 조작할 수 없다.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION booking_sync_attendance_from_records(
  p_student_ids TEXT[], p_date DATE, p_actor_id TEXT DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_date IS NULL OR p_student_ids IS NULL OR array_length(p_student_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID');
  END IF;
  RETURN _booking_apply_auto_attendance(p_date, p_date, NULL, p_student_ids, FALSE, p_actor_id);
END $$;

-- ----------------------------------------------------------------
-- 7. 일일 다이제스트 재정의 — 2) 상담기록 독촉에서 자동 참석분 제외.
--    일반 상담보고로 자동 참석된 예약은 예약 상담기록(booking_records)이 없는 것이
--    정상이므로 "상담기록 미작성" 알림을 보내지 않는다. 그 외 로직 무변경.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION booking_daily_digest()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  kst_date DATE := (now() AT TIME ZONE 'Asia/Seoul')::date;
  r RECORD;
BEGIN
  -- 1) 출결 미처리: 상담일이 지났는데 pending — 어제 상담분은 '오늘 자정까지' 임박,
  --    그제 이전 상담분은 기한 초과 (담당 강사 + 관리자 전원)
  FOR r IN
    SELECT res.id, res.student_id, s.educator_id, s.date, s.start_time,
           p.name AS program_name, u.name AS student_name,
           (s.date <= kst_date - 2) AS overdue
    FROM booking_reservations res
    JOIN booking_slots s ON s.id = res.slot_id
    JOIN booking_programs p ON p.id = res.program_id
    JOIN users u ON u.id = res.student_id
    WHERE res.status = 'confirmed' AND res.attendance_status = 'pending'
      AND s.date < kst_date
  LOOP
    DECLARE
      v_type TEXT := CASE WHEN r.overdue THEN 'attendance_overdue' ELSE 'attendance_pending' END;
      v_msg  TEXT := '[' || r.program_name || '] ' || to_char(r.date, 'MM/DD') || ' '
                     || r.student_name || ' 출결이 미처리 상태입니다.'
                     || CASE WHEN r.overdue THEN ' (처리기한 초과)' ELSE ' (오늘 자정까지)' END;
      v_admin RECORD;
    BEGIN
      IF r.educator_id IS NOT NULL THEN
        PERFORM _booking_notify_once(r.educator_id, v_type, r.id, v_msg);
      END IF;
      IF r.overdue THEN
        FOR v_admin IN SELECT id FROM users WHERE role = 'admin' AND status = 'active' LOOP
          PERFORM _booking_notify_once(v_admin.id, v_type, r.id, v_msg);
        END LOOP;
      END IF;
    END;
  END LOOP;

  -- 2) 상담기록: 참석 처리됐는데 작성 완료가 아닌 건 (자동 참석분 제외).
  --    작성기한 = 상담일 + 7일 23:59:59. 기한이 오늘·내일이면 임박, 지났으면 초과.
  FOR r IN
    SELECT res.id, s.educator_id, s.date,
           p.name AS program_name, u.name AS student_name,
           (s.date + 7 < kst_date) AS overdue
    FROM booking_reservations res
    JOIN booking_slots s ON s.id = res.slot_id
    JOIN booking_programs p ON p.id = res.program_id
    JOIN users u ON u.id = res.student_id
    WHERE res.attendance_status = 'attended'
      AND res.attendance_marked_by IS DISTINCT FROM 'system'
      AND NOT EXISTS (
        SELECT 1 FROM booking_records br
        WHERE br.reservation_id = res.id AND br.status = 'done'
      )
      AND s.date + 7 <= kst_date + 1
  LOOP
    DECLARE
      v_type TEXT := CASE WHEN r.overdue THEN 'record_overdue' ELSE 'record_due' END;
      v_msg  TEXT := '[' || r.program_name || '] ' || to_char(r.date, 'MM/DD') || ' '
                     || r.student_name || ' 상담기록이 미작성 상태입니다.'
                     || CASE WHEN r.overdue THEN ' (작성기한 초과)'
                        ELSE ' (기한: ' || to_char(r.date + 7, 'MM/DD') || ')' END;
      v_admin RECORD;
    BEGIN
      IF r.educator_id IS NOT NULL THEN
        PERFORM _booking_notify_once(r.educator_id, v_type, r.id, v_msg);
      END IF;
      IF r.overdue THEN
        FOR v_admin IN SELECT id FROM users WHERE role = 'admin' AND status = 'active' LOOP
          PERFORM _booking_notify_once(v_admin.id, v_type, r.id, v_msg);
        END LOOP;
      END IF;
    END;
  END LOOP;

  -- 3) 강사 당일 상담 일정 알림 (명세 17.2) — 강사·날짜당 1회
  FOR r IN
    SELECT s.educator_id, count(*) AS cnt
    FROM booking_reservations res
    JOIN booking_slots s ON s.id = res.slot_id
    WHERE res.status = 'confirmed' AND s.date = kst_date AND s.educator_id IS NOT NULL
    GROUP BY s.educator_id
  LOOP
    PERFORM _booking_notify_once(r.educator_id, 'today_schedule', 'today-' || kst_date,
      '오늘 예약된 상담이 ' || r.cnt || '건 있습니다. 타임테이블을 확인해 주세요.');
  END LOOP;
END $$;
