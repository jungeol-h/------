-- ================================================================
-- 센터 이용시간 등록 (시간대별 출석부) 마이그레이션
-- Supabase Dashboard > SQL Editor 에서 전체 실행 (재실행 안전)
--
-- 배경: 구글폼의 겹치는 시간블록(M1~SU5) 신청을 대체한다. 학생이 요일×1시간
-- 단위로 센터 이용시간을 직접 등록하고, 관리자는 시간대별 명단·출석부 엑셀을
-- 뽑는다. 단위 시간 정의(요일별 시각표)는 소스의 data/centerHours.js가 정본이고
-- DB는 start/end 시각을 그대로 저장만 한다.
--
-- 설계 (add-booking-system.sql 관례 승계):
--  - 정원(기본 40명/단위) 최종 검증은 SECURITY DEFINER RPC 안. 좌석 카운터
--    컬럼 없음 — 마감은 등록 행 count 파생. 저장 전 전역 advisory lock으로
--    직렬화한다 (수십 명 규모라 전역 락으로 충분).
--  - 설정(등록 열림/정원)은 admin_config('center_hours') jsonb 한 행.
--  - 등·하원 시간표(attendance_schedules) 동기화는 별도 RPC — 관리자가
--    명시적으로 실행할 때만 반영한다 (라이브 키오스크 판정에 쓰이므로).
-- ================================================================

-- ----------------------------------------------------------------
-- 1. 등록 테이블 — 학생 × 요일 × 1시간 단위
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS center_hour_registrations (
  id          TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INT  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=일 (JS getDay 규약)
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL CHECK (end_time > start_time),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, day_of_week, start_time)
);

CREATE INDEX IF NOT EXISTS idx_center_hour_reg_unit
  ON center_hour_registrations (day_of_week, start_time);

-- ----------------------------------------------------------------
-- 2. 설정 — 등록 열림 여부 · 단위 시간당 정원
-- ----------------------------------------------------------------
INSERT INTO admin_config (key, value)
VALUES ('center_hours', '{"isOpen": true, "capacity": 40}')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------
-- 3. RPC — 학생 이용시간 전체 저장 (본인 등록분 전면 교체)
--    p_entries = [{"day":1,"start":"16:00","end":"17:00"}, ...]
--    실패 코드: NOT_FOUND / LOCKED / SLOT_FULL(full: 마감 단위 목록)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION center_save_hours(
  p_student_id TEXT, p_actor_role TEXT, p_entries JSONB
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cfg      JSONB;
  v_capacity INT;
  v_is_open  BOOLEAN;
  v_full     JSONB := '[]'::jsonb;
  e          RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_student_id AND role = 'student') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;

  SELECT value INTO v_cfg FROM admin_config WHERE key = 'center_hours';
  v_capacity := COALESCE((v_cfg->>'capacity')::int, 40);
  v_is_open  := COALESCE((v_cfg->>'isOpen')::boolean, FALSE);

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

  RETURN jsonb_build_object('ok', true);
END $$;

-- ----------------------------------------------------------------
-- 4. RPC — 등·하원 시간표(attendance_schedules) 일괄 동기화 (관리자 전용)
--    등록이 1건 이상 있는 학생만 대상: 센터 운영요일(일0·월1·화2·금5·토6)의
--    기존 행을 지우고 첫 시작=등원, 마지막 끝=하원으로 재생성한다.
--    수(3)·목(4) 등 비운영 요일 행과 등록 없는 학생은 건드리지 않는다.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION center_sync_attendance_schedules(
  p_actor_role TEXT
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_students INT;
BEGIN
  IF p_actor_role <> 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('center_hours_save'));

  DELETE FROM attendance_schedules s
  WHERE s.day_of_week IN (0, 1, 2, 5, 6)
    AND EXISTS (SELECT 1 FROM center_hour_registrations r
                WHERE r.student_id = s.student_id);

  INSERT INTO attendance_schedules (id, student_id, day_of_week, arrival_time, departure_time)
  SELECT 'sch-' || gen_random_uuid(), student_id, day_of_week,
         min(start_time), max(end_time)
  FROM center_hour_registrations
  GROUP BY student_id, day_of_week;

  SELECT count(DISTINCT student_id) INTO v_students FROM center_hour_registrations;
  RETURN jsonb_build_object('ok', true, 'students', v_students);
END $$;

-- ----------------------------------------------------------------
-- RLS — 새 테이블은 RLS 기본 활성화라 anon 정책이 없으면 침묵 실패한다 (관례)
-- 읽기는 클라 직접 조회, 쓰기는 RPC 경유가 코드 규약이다.
-- ----------------------------------------------------------------
ALTER TABLE center_hour_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON center_hour_registrations;
CREATE POLICY "anon_all" ON center_hour_registrations
  FOR ALL TO anon USING (true) WITH CHECK (true);
