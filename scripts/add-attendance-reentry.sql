-- ============================================================
-- 하루 2회 이상 등원(재등원) 지원 (2026-07-31)
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN (재실행 안전)
-- ------------------------------------------------------------
-- 배경: attendance_records는 학생·날짜당 1행(UNIQUE student_id,date —
-- 절대 변경 금지, judge_attendance의 ON CONFLICT가 이 인덱스에 의존).
-- 지금까지는 kiosk_check_in이 check_in_at IS NOT NULL이면 무조건
-- 'already_in'으로 막아, 하원 후 다시 등원(외출 후 재등원 등)을 기록할
-- 방법이 없었다.
--
-- 설계: 하루 1행 유지 + events(jsonb) 로그로 등·하원 이력 누적.
--  - check_in_at: 최초 등원 시각으로 유지(지각 판정 스냅샷 보존)
--  - check_out_at: 하원 시 채워짐 → 재등원 시 NULL로 리셋해 "현재 등원 중"
--    상태를 되살린다 (checkout_status도 함께 리셋)
--  - events: [{"type":"in"|"out","at":"<timestamptz>"}] 순서대로 append.
--    하원 재입력(이미 하원 상태에서 다시 하원 누른 경우)은 마지막 'out'
--    이벤트의 시각만 갱신(중복 append 방지) — 기존 재입력 동작과 정합.
--
-- 영향 범위 점검 (나매크 규칙: 컬럼 의미 변경 시 다른 SQL RPC 소비처 확인):
--  - judge_attendance(): NOT EXISTS 조건이 check_in_at IS NOT NULL만 본다
--    (check_out_at 미참조) → 재등원으로 check_out_at을 NULL 리셋해도
--    "이미 등원 기록 있음" 처리는 변하지 않아 안전. 영향 없음.
--  - kiosk_find_students(): checked_in/checked_out 의미를 명확화(추가 필드는
--    아래 4번 참고) — 반환 컬럼 순서·이름 기존 유지, 필드 추가만.
--  - 그 외 *.sql 파일 중 kiosk_check_in/kiosk_check_out/kiosk_find_students를
--    재정의하는 곳은 fix-kiosk-phone-lookup.sql(검색 조건만 교체, 반환 로직
--    동일)뿐 — 이 스크립트가 최신판을 대체한다.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. events 컬럼 추가
-- ----------------------------------------------------------------
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS events JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ----------------------------------------------------------------
-- 2. kiosk_check_in — 하원 완료 후 재등원 허용
--    원본은 supabase_attendance_migration.sql(95-151행), 이후 수정 이력 없음
--    (fix-kiosk-phone-lookup.sql은 kiosk_find_students만 건드림).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION kiosk_check_in(p_student_id TEXT)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  kst_now     TIMESTAMP := now() AT TIME ZONE 'Asia/Seoul';
  kst_date    DATE      := (now() AT TIME ZONE 'Asia/Seoul')::date;
  sched       attendance_schedules%ROWTYPE;
  rec         attendance_records%ROWTYPE;
  v_status    TEXT;
  v_corrected BOOLEAN := FALSE;
  v_reentry   BOOLEAN := FALSE;
BEGIN
  SELECT * INTO sched FROM attendance_schedules
   WHERE student_id = p_student_id
     AND day_of_week = EXTRACT(DOW FROM kst_date);

  SELECT * INTO rec FROM attendance_records
   WHERE student_id = p_student_id AND date = kst_date;

  -- 현재 등원 중(하원 안 함) — 기존과 동일하게 already_in
  IF rec.id IS NOT NULL AND rec.check_in_at IS NOT NULL AND rec.check_out_at IS NULL THEN
    RETURN jsonb_build_object('result', 'already_in', 'record', to_jsonb(rec));
  END IF;

  -- 하원 완료 상태에서 다시 등원 → 재등원 (하루 1행 유지, check_out_at만 리셋)
  IF rec.id IS NOT NULL AND rec.check_in_at IS NOT NULL AND rec.check_out_at IS NOT NULL THEN
    v_reentry := TRUE;
    UPDATE attendance_records
       SET check_out_at    = NULL,
           checkout_status = NULL,
           events           = events || jsonb_build_object('type', 'in', 'at', now()),
           note = CASE WHEN coalesce(note, '') = '' THEN '재등원'
                       ELSE note || ' / 재등원' END
     WHERE id = rec.id
     RETURNING * INTO rec;

    RETURN jsonb_build_object(
      'result',      rec.status,  -- 최초 판정(late/present)을 그대로 유지해 반환
      'corrected',   FALSE,
      'no_schedule', sched.id IS NULL,
      'reentry',     TRUE,
      'record',      to_jsonb(rec)
    );
  END IF;

  IF sched.id IS NULL THEN
    v_status := 'present';  -- 시간표 없는 날 — 판정 없이 등원만 기록
  ELSIF date_trunc('minute', kst_now)::time > sched.arrival_time THEN
    v_status := 'late';
  ELSE
    v_status := 'present';
  END IF;

  IF rec.id IS NOT NULL THEN
    -- 30분 경과로 자동 결석 확정된 후 뒤늦게 등원 → 지각으로 정정
    v_status    := 'late';
    v_corrected := TRUE;
    UPDATE attendance_records
       SET status      = v_status,
           check_in_at = now(),
           source      = 'kiosk',
           events      = events || jsonb_build_object('type', 'in', 'at', now()),
           note        = CASE WHEN coalesce(note, '') = '' THEN '자동결석 후 등원'
                              ELSE note || ' / 자동결석 후 등원' END
     WHERE id = rec.id
     RETURNING * INTO rec;
  ELSE
    INSERT INTO attendance_records
      (id, student_id, date, status, check_in_at, scheduled_arrival, scheduled_departure, source, events)
    VALUES
      ('at-' || gen_random_uuid(), p_student_id, kst_date, v_status, now(),
       sched.arrival_time, sched.departure_time, 'kiosk',
       jsonb_build_array(jsonb_build_object('type', 'in', 'at', now())))
    RETURNING * INTO rec;
  END IF;

  RETURN jsonb_build_object(
    'result',      v_status,
    'corrected',   v_corrected,
    'no_schedule', sched.id IS NULL,
    'reentry',     v_reentry,
    'record',      to_jsonb(rec)
  );
END $$;

-- ----------------------------------------------------------------
-- 3. kiosk_check_out — events 로그 추가 (기존 덮어쓰기 동작·반환 형태 유지)
--    직전 이벤트가 'out'이면(재입력 = 갱신) 마지막 'out'만 시각 교체,
--    그 외(최초 하원, 또는 재등원 후 다시 하원)는 새 'out' 이벤트 append.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION kiosk_check_out(p_student_id TEXT)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  kst_now    TIMESTAMP := now() AT TIME ZONE 'Asia/Seoul';
  kst_date   DATE      := (now() AT TIME ZONE 'Asia/Seoul')::date;
  rec        attendance_records%ROWTYPE;
  v_checkout TEXT;
  v_first    BOOLEAN;
  v_last_type TEXT;
  v_events   JSONB;
BEGIN
  SELECT * INTO rec FROM attendance_records
   WHERE student_id = p_student_id AND date = kst_date;

  IF rec.id IS NULL OR rec.check_in_at IS NULL THEN
    RETURN jsonb_build_object('result', 'no_check_in');
  END IF;

  v_first := rec.check_out_at IS NULL;

  IF rec.scheduled_departure IS NOT NULL
     AND date_trunc('minute', kst_now)::time < rec.scheduled_departure THEN
    v_checkout := 'early_leave';
  ELSE
    v_checkout := 'normal';
  END IF;

  -- 직전 이벤트 종류 확인 (재입력이면 마지막 'out'만 시각 교체)
  v_last_type := (rec.events -> (jsonb_array_length(rec.events) - 1) ->> 'type');
  IF jsonb_array_length(rec.events) > 0 AND v_last_type = 'out' THEN
    v_events := (rec.events - (jsonb_array_length(rec.events) - 1))
                || jsonb_build_object('type', 'out', 'at', now());
  ELSE
    v_events := rec.events || jsonb_build_object('type', 'out', 'at', now());
  END IF;

  UPDATE attendance_records
     SET check_out_at    = now(),
         checkout_status = v_checkout,
         events           = v_events,
         -- 조퇴 사유(하원 시각)는 최초 하원 시에만 note에 남긴다 (재입력 시 중복 방지)
         note = CASE
                  WHEN v_checkout = 'early_leave' AND v_first THEN
                    CASE WHEN coalesce(note, '') = '' THEN '조퇴 (하원 ' || to_char(kst_now, 'HH24:MI') || ')'
                         ELSE note || ' / 조퇴 (하원 ' || to_char(kst_now, 'HH24:MI') || ')' END
                  ELSE note
                END
   WHERE id = rec.id
   RETURNING * INTO rec;

  RETURN jsonb_build_object('result', v_checkout, 'record', to_jsonb(rec));
END $$;

-- ----------------------------------------------------------------
-- 4. kiosk_find_students — checkedIn을 "현재 등원 중"으로, checkedOut 추가
--    원본은 supabase_attendance_migration.sql, 이후 fix-kiosk-phone-lookup.sql이
--    검색 조건을 password→phone으로 교체 — 그 최신판을 기반으로 함.
--    시그니처(함수명·인자·반환 컬럼) 변경 없음 — checked_in의 "의미"만
--    "등원 기록 있음" → "현재 등원 중(하원 안 함)"으로 정정, checked_out은
--    기존에도 있던 컬럼이라 이미 반환되고 있었음(추가 컬럼 없음).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION kiosk_find_students(p_digits TEXT)
RETURNS TABLE (
  id          TEXT,
  name        TEXT,
  grade       TEXT,
  class_name  TEXT,
  checked_in  BOOLEAN,
  checked_out BOOLEAN
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT u.id, u.name, u.grade, u.class_name,
         (ar.check_in_at IS NOT NULL AND ar.check_out_at IS NULL) AS checked_in,
         (ar.check_out_at IS NOT NULL)                            AS checked_out
  FROM users u
  LEFT JOIN attendance_records ar
    ON ar.student_id = u.id
   AND ar.date = (now() AT TIME ZONE 'Asia/Seoul')::date
  WHERE u.role = 'student'
    AND u.status = 'active'
    AND right(u.phone, 4) = p_digits
  ORDER BY u.name;
$$;

-- 적용 확인:
--   select column_name from information_schema.columns
--    where table_name = 'attendance_records' and column_name = 'events';
--   -- 등원→하원→재등원 시나리오 수동 테스트:
--   -- select kiosk_check_in('학생id'); select kiosk_check_out('학생id');
--   -- select kiosk_check_in('학생id'); -- result에 "reentry": true 포함돼야 정상
