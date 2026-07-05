-- ================================================================
-- 출결 판정 및 긴급 알림 (시간 기준 강화) 마이그레이션
-- Supabase Dashboard > SQL Editor 에서 전체 실행 (재실행 안전)
--
-- 설계 원칙: PWA는 닫혀 있으면 코드가 돌지 않으므로 시각 판정은 전부 DB에서.
--  - 입력 시점 판정(지각·조퇴): 키오스크 RPC가 DB now() 기준으로 판정
--  - 시간 경과 판정(10분 알림·30분 결석): pg_cron이 매분 judge_attendance() 실행
-- 모든 시각 비교는 KST(now() AT TIME ZONE 'Asia/Seoul') 기준 — 단말 시계 불신.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. 요일별 등·하원 시간표 (행 없음 = 그 요일 등원 안 함)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_schedules (
  id             TEXT PRIMARY KEY,
  student_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week    INT  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=일 (JS getDay 규약)
  arrival_time   TIME NOT NULL,
  departure_time TIME NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, day_of_week)
);

-- ----------------------------------------------------------------
-- 2. attendance_records 확장 (기존: id/student_id/date/status/created_at)
-- ----------------------------------------------------------------
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS check_in_at         TIMESTAMPTZ;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS check_out_at        TIMESTAMPTZ;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS scheduled_arrival   TIME;  -- 판정 당시 스냅샷 (시간표 변경에 안전)
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS scheduled_departure TIME;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS checkout_status     TEXT;  -- NULL | 'normal' | 'early_leave'(조퇴)
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS source              TEXT DEFAULT 'kiosk';  -- 'kiosk' | 'auto' | 'manual'
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS note                TEXT DEFAULT '';

-- 학생·날짜당 1행 보장 — cron 멱등성(ON CONFLICT)의 기반
CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_student_date
  ON attendance_records (student_id, date);

-- ----------------------------------------------------------------
-- 3. 발송형 긴급 알림
--    기존 alerts는 "매니저 코칭 레코드"(행위주체 매니저)라 성격이 달라 분리.
--    M3(Web Push)에서 이 테이블이 그대로 발송 큐가 된다.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_notifications (
  id         TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  type       TEXT NOT NULL,            -- 'no_show'(10분 미등원) | 'auto_absent'(30분 결석 확정)
  message    TEXT NOT NULL,
  resolved   BOOLEAN DEFAULT FALSE,    -- 매니저 확인 처리
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, date, type)      -- cron이 매분 돌아도 학생·날짜·종류당 1회만
);

-- 매니저 화면 실시간 배너용 — Realtime INSERT 구독 대상으로 등록
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE attendance_notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------
-- 4. RPC: 키오스크 번호 매칭
--    password(010+8자리) 뒷 4자리로 active 학생 검색.
--    password 원문은 반환하지 않는다 (클라이언트 노출 금지).
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
         (ar.check_in_at IS NOT NULL)  AS checked_in,
         (ar.check_out_at IS NOT NULL) AS checked_out
  FROM users u
  LEFT JOIN attendance_records ar
    ON ar.student_id = u.id
   AND ar.date = (now() AT TIME ZONE 'Asia/Seoul')::date
  WHERE u.role = 'student'
    AND u.status = 'active'
    AND right(u.password, 4) = p_digits
  ORDER BY u.name;
$$;

-- ----------------------------------------------------------------
-- 5. RPC: 등원 처리 — 지각 판정 (명세 1항)
--    분 단위 비교(초 버림): 예정 15:00, 입력 15:00:59 → 정상 등원.
--    cron이 먼저 만든 자동 결석 행이 있으면 '지각'으로 정정.
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
BEGIN
  SELECT * INTO sched FROM attendance_schedules
   WHERE student_id = p_student_id
     AND day_of_week = EXTRACT(DOW FROM kst_date);

  SELECT * INTO rec FROM attendance_records
   WHERE student_id = p_student_id AND date = kst_date;

  IF rec.id IS NOT NULL AND rec.check_in_at IS NOT NULL THEN
    RETURN jsonb_build_object('result', 'already_in', 'record', to_jsonb(rec));
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
           note        = CASE WHEN coalesce(note, '') = '' THEN '자동결석 후 등원'
                              ELSE note || ' / 자동결석 후 등원' END
     WHERE id = rec.id
     RETURNING * INTO rec;
  ELSE
    INSERT INTO attendance_records
      (id, student_id, date, status, check_in_at, scheduled_arrival, scheduled_departure, source)
    VALUES
      ('at-' || gen_random_uuid(), p_student_id, kst_date, v_status, now(),
       sched.arrival_time, sched.departure_time, 'kiosk')
    RETURNING * INTO rec;
  END IF;

  RETURN jsonb_build_object(
    'result',      v_status,
    'corrected',   v_corrected,
    'no_schedule', sched.id IS NULL,
    'record',      to_jsonb(rec)
  );
END $$;

-- ----------------------------------------------------------------
-- 6. RPC: 하원 처리 — 조퇴 자동 판정 (명세 4항)
--    하원 예정보다 이르면 별도 승인 없이 'early_leave' + note에 하원 시각 기록.
--    재입력 시 최신 시각으로 갱신하고 다시 판정한다.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION kiosk_check_out(p_student_id TEXT)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  kst_now    TIMESTAMP := now() AT TIME ZONE 'Asia/Seoul';
  kst_date   DATE      := (now() AT TIME ZONE 'Asia/Seoul')::date;
  rec        attendance_records%ROWTYPE;
  v_checkout TEXT;
  v_first    BOOLEAN;
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

  UPDATE attendance_records
     SET check_out_at    = now(),
         checkout_status = v_checkout,
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
-- 7. 시간 경과 판정 — pg_cron이 매분 실행 (명세 2·3항)
--    미등원 상태에서 등원 예정 +10분 → 'no_show' 긴급 알림 생성
--                    등원 예정 +30분 → 무단 결석 확정 + 'auto_absent' 알림
--    UNIQUE + ON CONFLICT DO NOTHING 으로 매분 돌아도 1회만 생성(멱등).
--    주의: TIME 덧셈은 자정을 넘으면 wrap된다 — 등원 예정이 23:30 이후인
--    운영은 상정하지 않는다.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION judge_attendance()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  kst_now  TIMESTAMP := now() AT TIME ZONE 'Asia/Seoul';
  kst_date DATE      := (now() AT TIME ZONE 'Asia/Seoul')::date;
  s RECORD;
BEGIN
  FOR s IN
    SELECT u.id, u.name, sc.arrival_time, sc.departure_time
    FROM users u
    JOIN attendance_schedules sc
      ON sc.student_id = u.id
     AND sc.day_of_week = EXTRACT(DOW FROM kst_date)
    WHERE u.role = 'student'
      AND u.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM attendance_records ar
        WHERE ar.student_id = u.id
          AND ar.date = kst_date
          AND ar.check_in_at IS NOT NULL
      )
  LOOP
    -- 명세 2항: 10분 경과 미등원 → 긴급 확인 알림
    IF kst_now::time >= s.arrival_time + interval '10 minutes' THEN
      INSERT INTO attendance_notifications (id, student_id, date, type, message)
      VALUES ('an-' || gen_random_uuid(), s.id, kst_date, 'no_show',
              s.name || ' 학생 미등원 — 등원 예정 ' || to_char(s.arrival_time, 'HH24:MI')
                     || ', 10분 경과. 긴급 확인이 필요합니다.')
      ON CONFLICT (student_id, date, type) DO NOTHING;
    END IF;

    -- 명세 3항: 30분 경과 미등원 → 무단 결석 자동 확정
    IF kst_now::time >= s.arrival_time + interval '30 minutes' THEN
      INSERT INTO attendance_records
        (id, student_id, date, status, scheduled_arrival, scheduled_departure, source, note)
      VALUES
        ('at-' || gen_random_uuid(), s.id, kst_date, 'absent',
         s.arrival_time, s.departure_time, 'auto', '30분 미등원 자동 결석')
      ON CONFLICT (student_id, date) DO NOTHING;

      INSERT INTO attendance_notifications (id, student_id, date, type, message)
      VALUES ('an-' || gen_random_uuid(), s.id, kst_date, 'auto_absent',
              s.name || ' 학생 무단 결석 확정 — 등원 예정 ' || to_char(s.arrival_time, 'HH24:MI')
                     || ', 30분 경과.')
      ON CONFLICT (student_id, date, type) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------
-- 8. pg_cron 스케줄 등록
--    pg_cron은 UTC 기준으로 돈다 — KST 07~23시 = UTC 22~23시 + 00~14시.
--    (Supabase Dashboard > Database > Extensions 에서 pg_cron 활성화 필요)
-- ----------------------------------------------------------------
-- ----------------------------------------------------------------
-- 8-1. RLS — 새 테이블은 RLS가 기본 활성화되므로 anon 정책 필요
--      (patch-quiz-rls.sql과 동일 관례. 없으면 클라이언트 직접 조회/저장이
--       빈 결과·42501로 막힌다. SECURITY DEFINER RPC는 영향 없음)
-- ----------------------------------------------------------------
ALTER TABLE attendance_schedules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all" ON attendance_schedules;
DROP POLICY IF EXISTS "anon_all" ON attendance_notifications;

CREATE POLICY "anon_all" ON attendance_schedules     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON attendance_notifications FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('attendance-judge');
EXCEPTION WHEN OTHERS THEN NULL;  -- 최초 실행 시 잡이 없으면 무시
END $$;

SELECT cron.schedule('attendance-judge', '* 0-14,22-23 * * *', 'SELECT judge_attendance()');
