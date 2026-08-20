-- ============================================================
-- 예약 상담기록(지도보고서)에 실제 상담 시간 기록 (2026-08-20)
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN (재실행 안전)
-- ------------------------------------------------------------
-- 배경: 예약 유래 상담(booking_records)은 시간 필드가 없어 월간 종합 보고서·
-- 컨설팅보고서의 상담시간 집계가 예약 슬롯 시간(start/end)을 그대로 썼다.
-- 클라이언트 요청(2026-08-20): "월간보고서의 집계를 예약 기준이 아니라
-- 실제 보고서 작성 결과 기준으로" — 강사가 지도보고서에 실제 상담 시간을
-- 기록하면 집계가 그 시간을 쓰도록 한다.
--
-- 설계: counseling_records와 동일하게 TEXT 'HH:MM' 컬럼 2개 추가(널 허용).
--  - 신규 작성/수정 시 RecordFormModal이 채운다 (기본값 = 슬롯 시간).
--  - 기존 기록·미입력 기록은 NULL → 앱 매퍼(toBookingCounselingRecord)가
--    슬롯 시간으로 폴백해 기존 동작과 동일하다.
--
-- 영향 범위 점검 (나매크 규칙: 컬럼 의미 변경 시 다른 SQL RPC 소비처 확인):
--  - booking_records를 참조하는 RPC는 add-booking-system.sql의 알림 생성부
--    (reservation_id·status만 사용)뿐 — 컬럼 추가만이라 영향 없음.
--  - ⚠️ 배포 순서: 이 SQL을 먼저 적용해야 한다. 미적용 상태에서 신코드로
--    지도보고서를 저장하면 upsert가 start_time 컬럼 부재로 실패한다.
--    (읽기 경로는 미적용이어도 안전 — 키 부재 시 슬롯 폴백)
-- ============================================================

ALTER TABLE booking_records ADD COLUMN IF NOT EXISTS start_time TEXT;
ALTER TABLE booking_records ADD COLUMN IF NOT EXISTS end_time   TEXT;

-- 적용 확인:
--   select column_name from information_schema.columns
--    where table_name = 'booking_records' and column_name in ('start_time','end_time');
