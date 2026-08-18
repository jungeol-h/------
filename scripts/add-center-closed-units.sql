-- ================================================================
-- 센터 시간 블록 열기/닫기 마이그레이션 (2026-08-18)
-- Supabase Dashboard > SQL Editor 에서 전체 실행 (재실행 안전)
--
-- 배경: 운영 요일 전체가 아니라 특정 시간 블록(요일×1시간 단위)만 닫고 싶다는
-- 요청 (2026-08-18 클라이언트). admin_config('center_hours').closedUnits
-- (unitKey "<day>#<HH:MM>" 문자열 배열, day는 JS getDay int)를 단일 진실원으로
-- 삼고, 관리자 출결 탭의 시간대별 명단 헤더 토글 UI가 이 값을 수정한다.
--
-- 의미: 닫힌 단위는 학생이 새로 선택할 수 없다. 이미 그 단위에 등록돼 있던
-- 학생의 기존 등록은 유지되고 해제(선택 취소)만 가능하다. 관리자·매니저
-- 대리 수정은 잠금·정원과 마찬가지로 닫힘도 무시한다. 닫아도 기존 등록이
-- 남으므로 등·하원 시간표 파생 로직은 무변경.
--
-- 변경:
--  1. admin_config('center_hours')에 closedUnits 기본값([]) 백필
--  2. center_save_hours v4 — 비관리자 저장 시 닫힌 단위 신규 선택을
--     UNIT_CLOSED로 거절 (정원 검사와 같은 루프에서 모으고 UNIT_CLOSED 우선
--     반환). 잠금·정원·advisory lock·시간표 파생(v3)은 무변경.
--     center_sync_attendance_schedules 도 무변경.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. 설정 백필 — closedUnits 없으면 빈 배열로 채움
-- ----------------------------------------------------------------
INSERT INTO admin_config (key, value)
VALUES ('center_hours', '{"isOpen": true, "capacity": 40, "operatingDays": [1, 2, 5, 6, 0], "closedUnits": []}')
ON CONFLICT (key) DO UPDATE
SET value = admin_config.value || '{"closedUnits": []}'
WHERE NOT admin_config.value ? 'closedUnits';

-- ----------------------------------------------------------------
-- 2. RPC — 학생 이용시간 전체 저장 (닫힌 단위를 검증하는 v4)
--    실패 코드: NOT_FOUND / LOCKED / UNIT_CLOSED(closed: 닫힌 단위 목록)
--             / SLOT_FULL(full: 마감 단위 목록)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION center_save_hours(
  p_student_id TEXT, p_actor_role TEXT, p_entries JSONB
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cfg         JSONB;
  v_capacity    INT;
  v_is_open     BOOLEAN;
  v_days        INT[];
  v_closed      TEXT[];
  v_full        JSONB := '[]'::jsonb;
  v_closed_hits JSONB := '[]'::jsonb;
  e             RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_student_id AND role = 'student') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;

  SELECT value INTO v_cfg FROM admin_config WHERE key = 'center_hours';
  v_capacity := COALESCE((v_cfg->>'capacity')::int, 40);
  v_is_open  := COALESCE((v_cfg->>'isOpen')::boolean, FALSE);
  v_days     := COALESCE(
    (SELECT array_agg(x::int) FROM jsonb_array_elements_text(v_cfg->'operatingDays') x),
    ARRAY[0, 1, 2, 5, 6]);
  v_closed   := COALESCE(
    (SELECT array_agg(x) FROM jsonb_array_elements_text(v_cfg->'closedUnits') x),
    ARRAY[]::text[]);

  -- 관리자·매니저는 잠금·정원·닫힘을 무시하고 대리 수정 가능
  IF p_actor_role NOT IN ('admin', 'manager') AND NOT v_is_open THEN
    RETURN jsonb_build_object('ok', false, 'code', 'LOCKED');
  END IF;

  -- 저장 직렬화 — 정원 count-then-write 원자성
  PERFORM pg_advisory_xact_lock(hashtext('center_hours_save'));

  IF p_actor_role NOT IN ('admin', 'manager') THEN
    FOR e IN
      SELECT (x->>'day')::int AS d, (x->>'start')::time AS st
      FROM jsonb_array_elements(p_entries) x
    LOOP
      -- 닫힌 단위: 그 단위에 기존 등록이 없는데 새로 넣으려는 경우만 위반
      -- (이미 등록돼 있던 학생의 유지·해제는 허용)
      IF (e.d::text || '#' || to_char(e.st, 'HH24:MI')) = ANY(v_closed)
         AND NOT EXISTS (SELECT 1 FROM center_hour_registrations
                         WHERE student_id = p_student_id
                           AND day_of_week = e.d AND start_time = e.st) THEN
        v_closed_hits := v_closed_hits || jsonb_build_object(
          'day', e.d, 'start', to_char(e.st, 'HH24:MI'));
      END IF;
      IF (SELECT count(*) FROM center_hour_registrations
          WHERE day_of_week = e.d AND start_time = e.st
            AND student_id <> p_student_id) >= v_capacity THEN
        v_full := v_full || jsonb_build_object(
          'day', e.d, 'start', to_char(e.st, 'HH24:MI'));
      END IF;
    END LOOP;
    IF jsonb_array_length(v_closed_hits) > 0 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'UNIT_CLOSED', 'closed', v_closed_hits);
    END IF;
    IF jsonb_array_length(v_full) > 0 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'SLOT_FULL', 'full', v_full);
    END IF;
  END IF;

  DELETE FROM center_hour_registrations WHERE student_id = p_student_id;
  INSERT INTO center_hour_registrations (id, student_id, day_of_week, start_time, end_time)
  SELECT 'chr-' || gen_random_uuid(), p_student_id,
         (x->>'day')::int, (x->>'start')::time, (x->>'end')::time
  FROM jsonb_array_elements(p_entries) x;

  -- 등·하원 시간표 자동 파생 (v3) — 운영 요일 ∪ 이 학생의 등록 요일만 교체.
  -- 키오스크 지각·결석 판정 기준이 저장 즉시 따라온다. 그 밖의 요일 행은 보존.
  DELETE FROM attendance_schedules s
  WHERE s.student_id = p_student_id
    AND (s.day_of_week = ANY(v_days)
         OR EXISTS (SELECT 1 FROM center_hour_registrations r
                    WHERE r.student_id = p_student_id
                      AND r.day_of_week = s.day_of_week));
  INSERT INTO attendance_schedules (id, student_id, day_of_week, arrival_time, departure_time)
  SELECT 'sch-' || gen_random_uuid(), student_id, day_of_week,
         min(start_time), max(end_time)
  FROM center_hour_registrations
  WHERE student_id = p_student_id
  GROUP BY student_id, day_of_week;

  RETURN jsonb_build_object('ok', true);
END $$;
