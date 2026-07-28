-- ============================================================
-- 비밀번호 보안 1단계: 연락처 컬럼 분리 + 강제 재설정 플래그 (2026-07-29)
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN
-- ⚠️ 신코드 배포 전에 반드시 먼저 적용할 것 (scripts/README.md 규칙 2)
-- ------------------------------------------------------------
-- 배경: users.password가 평문 + 학생 전화번호 겸용, parent_password가
-- 학부모 전화번호 겸용이라 관리자가 모든 비밀번호를 볼 수 있었다.
-- 이 스크립트는 연락처를 전용 컬럼(phone/parent_phone)으로 분리하고,
-- 강제 재설정 판정용 password_changed_at을 추가한다.
--
-- 비밀번호 해시화 자체는 클라이언트 코드가 수행한다:
--   · 로그인 시 평문 fallback 비교 → 성공하면 그 자리에서 bcrypt 해시로 교체
--   · password_changed_at IS NULL 인 사용자는 첫 로그인 시 강제 재설정 모달
-- (SQL에서는 bcrypt 해시를 만들 수 없어 password 컬럼은 여기서 건드리지 않는다)
--
-- 전환 완료 후 후속 정리(별도 스크립트 예정):
--   · 전 계정 해시 전환 확인: select count(*) from users
--       where password !~ '^\$2' and status = 'active';  -- 0이면 완료
--   · parent_password 컬럼 drop + 클라이언트 평문 fallback 제거
-- 재실행 안전: IF NOT EXISTS / 조건부 UPDATE 로 멱등.
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_phone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

-- 겸용 저장돼 있던 전화번호를 전용 컬럼으로 복사.
-- 010+8자리 형식인 값만 — 자리표시('00000000000')·교직원 수동 비번은 제외.
-- (role='parent' 행의 password = 학부모 본인 전화 → phone으로 복사됨, 의도된 동작)
UPDATE users SET phone = password
 WHERE phone IS NULL AND password ~ '^010[0-9]{8}$';
UPDATE users SET parent_phone = parent_password
 WHERE parent_phone IS NULL AND parent_password ~ '^010[0-9]{8}$';

-- ------------------------------------------------------------
-- 학생 중복 방지 백스톱 이전: (name, password) → (name, phone)
-- 해시화되면 password는 계정마다 다른 salt를 가져 중복 감지가 무력화된다.
-- add-student-dedup-guard.sql의 인덱스를 phone 기반으로 교체.
-- ------------------------------------------------------------

-- 사전 점검: 위반 행이 있으면 인덱스 생성이 실패한다. 0행이어야 함.
SELECT name, phone, count(*), array_agg(id)
  FROM users
 WHERE role = 'student' AND phone IS NOT NULL
 GROUP BY name, phone
HAVING count(*) > 1;

DROP INDEX IF EXISTS users_student_name_phone_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_student_name_phone_key
  ON users (name, phone)
 WHERE role = 'student' AND phone IS NOT NULL;
