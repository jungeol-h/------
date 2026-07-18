-- 예약 시스템 테스트 데이터 정리 (2026-07-18 브라우저 E2E 검증 산출물)
-- Supabase Studio SQL Editor에서 전체 실행.
--
-- 지우는 것: 상담기록·예약·알림·슬롯(421개)·생성배치·감사이력 — 전부 테스트 산출물.
--   (예약 시스템은 아직 실오픈 전이라 거래 테이블 전체 비우기가 안전하다)
-- 남기는 것: booking_programs(3종 설정)·booking_subjects(국·영·수)·
--   booking_educators(강사 배정 5건)·booking_open_periods(진로진학 오픈기간)
--   — 실운영에 그대로 쓸 수 있는 설정. 오픈기간이 불필요하면 관리자 화면
--   프로그램 메뉴에서 삭제하면 된다.
--
-- ⚠️ 실오픈 후에는 절대 재실행하지 말 것 (실예약까지 지워진다).
--   일회성 스크립트 — 실행 후 scripts/README.md 대장 참고.

-- FK 순서: 기록 → 예약 → 슬롯 → 배치 (알림·감사는 FK 없음)
DELETE FROM booking_records;
DELETE FROM booking_reservations;
DELETE FROM booking_notifications;
DELETE FROM booking_slots;
DELETE FROM booking_timetable_batches;
DELETE FROM booking_audit_logs;

-- 확인: 전부 0이어야 한다
SELECT 'records'       AS t, count(*) FROM booking_records
UNION ALL SELECT 'reservations',  count(*) FROM booking_reservations
UNION ALL SELECT 'notifications', count(*) FROM booking_notifications
UNION ALL SELECT 'slots',         count(*) FROM booking_slots
UNION ALL SELECT 'batches',       count(*) FROM booking_timetable_batches
UNION ALL SELECT 'audit_logs',    count(*) FROM booking_audit_logs;

-- 유지된 설정 확인 (프로그램 3 · 교과 3 · 강사배정 5 · 오픈기간 1)
SELECT 'programs'  AS t, count(*) FROM booking_programs
UNION ALL SELECT 'subjects',  count(*) FROM booking_subjects
UNION ALL SELECT 'educators', count(*) FROM booking_educators
UNION ALL SELECT 'open_periods', count(*) FROM booking_open_periods;
