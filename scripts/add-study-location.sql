-- 학습 계획/기록의 공부 장소 컬럼 (센터·집·스카·학원·학교).
-- 운영 DB에 1회 실행. 재실행 안전.

ALTER TABLE learning_records
  ADD COLUMN IF NOT EXISTS study_location TEXT;
