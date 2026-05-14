-- ================================================================
-- users 테이블 gender 컬럼 추가
-- 운영 DB (베타테스트) 1회 실행. 멱등 (재실행 안전).
-- Supabase Dashboard > SQL Editor 에서 실행
-- ================================================================

-- 1. gender 컬럼 추가 (기존 행은 NULL — 관리자가 사용자 관리 탭에서 채움)
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;

-- 2. gender CHECK constraint (재실행 안전: 기존 제약 DROP 후 재생성)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_gender_check;
ALTER TABLE users ADD CONSTRAINT users_gender_check
  CHECK (gender IN ('M', 'F') OR gender IS NULL);

-- status 컬럼은 이미 DEFAULT 'active' 로 존재 — 추가 작업 없음.
-- RLS 정책(anon_all)도 기존 그대로 적용됨 — 추가 작업 없음.

-- 확인 쿼리 (선택)
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'users' ORDER BY ordinal_position;
