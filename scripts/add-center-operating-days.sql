-- ================================================================
-- 센터 운영 요일 설정화 마이그레이션 (2026-07-27)
-- Supabase Dashboard > SQL Editor 에서 전체 실행 (재실행 안전)
--
-- 배경: 운영 요일이 코드·RPC에 월·화·금·토·일로 하드코딩돼 있어 "이번 주는
-- 수·목도 오픈" 같은 임시 운영이 불가능했다 (2026-07-27 클라이언트 요청).
-- admin_config('center_hours').operatingDays(JS getDay 규약 int 배열)를 단일
-- 진실원으로 삼고, 관리자 출결 탭의 운영 요일 토글 UI가 이 값을 수정한다.
--
-- 변경:
--  1. admin_config('center_hours')에 operatingDays 기본값 백필
--  2. center_save_hours / center_sync_attendance_schedules 의 하드코딩
--     (0,1,2,5,6)을 설정 기반으로 교체. 등·하원 시간표 교체 범위는
--     "운영 요일 ∪ 그 학생의 등록 요일" — 운영 요일에서 빠진 요일에 남은
--     이전 등록도 중복 없이 재파생되도록 한다.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. 설정 백필 — operatingDays 없으면 기존 운영 요일로 채움
-- ----------------------------------------------------------------
INSERT INTO admin_config (key, value)
VALUES ('center_hours', '{"isOpen": true, "capacity": 40, "operatingDays": [1, 2, 5, 6, 0]}')
ON CONFLICT (key) DO UPDATE
SET value = admin_config.value || '{"operatingDays": [1, 2, 5, 6, 0]}'
WHERE NOT admin_config.value ? 'operatingDays';

-- ----------------------------------------------------------------
-- 2. RPC — 학생 이용시간 전체 저장 (운영 요일을 설정에서 읽는 v3)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION center_save_hours(
  p_student_id TEXT, p_actor_role TEXT, p_entries JSONB
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cfg      JSONB;
  v_capacity INT;
  v_is_open  BOOLEAN;
  v_days     INT[];
  v_full     JSONB := '[]'::jsonb;
  e          RECORD;
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

  -- 관리자·매니저는 잠금·정원을 무시하고 대리 수정 가능
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
      IF (SELECT count(*) FROM center_hour_registrations
          WHERE day_of_week = e.d AND start_time = e.st
            AND student_id <> p_student_id) >= v_capacity THEN
        v_full := v_full || jsonb_build_object(
          'day', e.d, 'start', to_char(e.st, 'HH24:MI'));
      END IF;
    END LOOP;
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

-- ----------------------------------------------------------------
-- 3. RPC — 등·하원 시간표 일괄 동기화 (관리자 전용, 운영 요일 설정 기반 v3)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION center_sync_attendance_schedules(
  p_actor_role TEXT
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cfg      JSONB;
  v_days     INT[];
  v_students INT;
BEGIN
  IF p_actor_role <> 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;

  SELECT value INTO v_cfg FROM admin_config WHERE key = 'center_hours';
  v_days := COALESCE(
    (SELECT array_agg(x::int) FROM jsonb_array_elements_text(v_cfg->'operatingDays') x),
    ARRAY[0, 1, 2, 5, 6]);

  PERFORM pg_advisory_xact_lock(hashtext('center_hours_save'));

  DELETE FROM attendance_schedules s
  WHERE EXISTS (SELECT 1 FROM center_hour_registrations r
                WHERE r.student_id = s.student_id)
    AND (s.day_of_week = ANY(v_days)
         OR EXISTS (SELECT 1 FROM center_hour_registrations r
                    WHERE r.student_id = s.student_id
                      AND r.day_of_week = s.day_of_week));

  INSERT INTO attendance_schedules (id, student_id, day_of_week, arrival_time, departure_time)
  SELECT 'sch-' || gen_random_uuid(), student_id, day_of_week,
         min(start_time), max(end_time)
  FROM center_hour_registrations
  GROUP BY student_id, day_of_week;

  SELECT count(DISTINCT student_id) INTO v_students FROM center_hour_registrations;
  RETURN jsonb_build_object('ok', true, 'students', v_students);
END $$;
