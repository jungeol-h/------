-- ================================================================
-- 예약 출결 자동 처리 — pg_cron 등록 (2026-09-30)
--
-- 선행: add-booking-auto-attendance.sql 적용 + 신 프런트 배포.
--   신 프런트 배포 전에 돌리면 자동 참석분에 구 화면이 "상담기록 미작성"을
--   띄우므로 반드시 배포 후에 적용한다.
--
-- 매일 KST 00:02 (UTC 15:02) — 일일 다이제스트(00:05)보다 먼저 돌아
--   자동 처리된 건에는 출결 미처리 알림이 가지 않게 한다.
--   기본 인자: 자동 참석 최근 60일, 자동 미참석 어제분만.
--
-- 과거 누적분 소급(선택, 1회 수동):
--   미리보기  SELECT rule, new_status, count(*)
--             FROM booking_auto_attendance_plan('2026-07-01', current_date, '2026-07-01') GROUP BY 1, 2;
--   참석만    SELECT booking_auto_attendance(120, 0, FALSE);
--   미참석도  SELECT booking_auto_attendance(120, 120, FALSE);   -- 알림 없이
--
-- 멱등 — 재실행 안전 (기존 잡 해제 후 재등록).
-- ================================================================

DO $$
BEGIN
  PERFORM cron.unschedule('booking-auto-attendance');
EXCEPTION WHEN OTHERS THEN NULL;  -- 최초 실행 시 잡이 없으면 무시
END $$;

SELECT cron.schedule('booking-auto-attendance', '2 15 * * *', 'SELECT booking_auto_attendance()');
