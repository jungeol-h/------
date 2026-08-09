-- ============================================================
-- 센터 휴무기간(방학·임시휴무) 마이그레이션 (2026-08-09 클라이언트 요청)
-- 배경: 8/10~17 센터 방학인데 요일제(센터 이용시간) 등록 학생이 전원
--       pg_cron judge_attendance()로 자동 결석 처리되는 문제.
-- 사용: Supabase Studio → SQL Editor → RUN (코드 배포 전에 먼저 실행)
-- 재실행 안전: IF NOT EXISTS / 조건부 insert / CREATE OR REPLACE
-- ------------------------------------------------------------
-- 1) center_closures — 기간 단위 휴무 (start~end 포함 범위)
-- 2) judge_attendance() 교체 — 휴무기간이면 판정 전체 스킵
--    (기존 본문은 supabase_attendance_migration.sql L207 원본과 동일,
--     휴무 가드 3줄만 추가. 실DB 정의와 대조 확인함 — 2026-08-09)
-- 3) 2026 여름 방학(8/10~17) 시드
--
-- 기존 자동 결석 레코드의 소급 삭제는 앱(휴무기간 관리 UI)에서 수행:
-- source='auto' AND check_in_at IS NULL 조건 — 수동 정정·실등원 기록은 보존.
-- ============================================================

-- ── 1) center_closures 테이블 ───────────────────────────────
CREATE TABLE IF NOT EXISTS center_closures (
  id         TEXT PRIMARY KEY,          -- 앱 makeId('cls') 생성 TEXT (프로젝트 관례)
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  label      TEXT NOT NULL DEFAULT '',  -- 예: '여름 방학'
  created_by TEXT,                      -- 작성자 users.id
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_center_closures_range
  ON center_closures (start_date, end_date);

-- RLS (기존 anon_all 체계와 동일 — lib/README.md 보안 부채 항목과 함께 재검토)
ALTER TABLE center_closures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_center_closures" ON center_closures;
CREATE POLICY "anon_all_center_closures" ON center_closures
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── 2) judge_attendance() — 휴무기간 가드 추가 ──────────────
CREATE OR REPLACE FUNCTION public.judge_attendance()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  kst_now  TIMESTAMP := now() AT TIME ZONE 'Asia/Seoul';
  kst_date DATE      := (now() AT TIME ZONE 'Asia/Seoul')::date;
  s RECORD;
BEGIN
  -- 휴무기간(방학·임시휴무)에는 미등원 알림·자동 결석 판정을 하지 않는다.
  IF EXISTS (
    SELECT 1 FROM center_closures c
    WHERE kst_date BETWEEN c.start_date AND c.end_date
  ) THEN
    RETURN;
  END IF;

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
END $function$;

-- ── 3) 2026 여름 방학 시드 (클라이언트 확정: 8/10~17) ───────
INSERT INTO center_closures (id, start_date, end_date, label)
SELECT 'cls-2026-summer', '2026-08-10', '2026-08-17', '센터 방학'
WHERE NOT EXISTS (SELECT 1 FROM center_closures WHERE id = 'cls-2026-summer');
