-- 학부모 계정 일괄 생성 — 학생의 parent_password(학부모 연락처) 기반.
-- 전화번호 기준 dedupe: 형제는 한 계정에 자녀 여러 명 연결(parent_children).
-- 로그인: login_id = 학부모 전화번호, password = 학부모 전화번호.
-- 멱등(ON CONFLICT DO NOTHING). 2026-07-18 REST로 적용됨(학부모 135·링크 144)
-- — 이후 신규 학생 등록분은 관리자 → 학생 → 학부모 계정 관리로 개별 처리하거나
--   이 스크립트를 Studio에서 재실행하면 된다.

WITH src AS (
  SELECT id AS student_id, name,
         regexp_replace(coalesce(parent_password, ''), '[^0-9]', '', 'g') AS phone
  FROM users
  WHERE role = 'student' AND status = 'active'
),
valid AS (
  SELECT * FROM src WHERE length(phone) >= 10
),
first_kid AS (
  SELECT DISTINCT ON (phone) phone, name
  FROM valid ORDER BY phone, student_id
)
INSERT INTO users (id, login_id, password, name, role, status)
SELECT 'p-' || phone, phone, phone, name || ' 학부모', 'parent', 'active'
FROM first_kid
ON CONFLICT (id) DO NOTHING;

WITH src AS (
  SELECT id AS student_id,
         regexp_replace(coalesce(parent_password, ''), '[^0-9]', '', 'g') AS phone
  FROM users
  WHERE role = 'student' AND status = 'active'
),
valid AS (
  SELECT * FROM src WHERE length(phone) >= 10
)
INSERT INTO parent_children (id, parent_id, student_id)
SELECT 'pc-' || phone || '-' || student_id, 'p-' || phone, student_id
FROM valid
ON CONFLICT DO NOTHING;
