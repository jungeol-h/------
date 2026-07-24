-- ============================================================
-- 학생 중복 등록 DB 백스톱 (2026-07-24)
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN
-- ------------------------------------------------------------
-- 배경: 이름 오타·login_id 변형으로 동일 학생이 5쌍 중복 등록됐던 사고.
-- 프론트(학생 추가 폼·일괄 등록)에 전화번호 기반 검사를 넣었지만,
-- 시드 SQL·스크립트 등 프론트를 거치지 않는 삽입까지 막는 최후 방어선.
--
-- 이름+비밀번호(=학생 전화번호)가 같은 학생 행을 금지한다. 상태 무관
-- (퇴원·신청취소 계정과도 충돌) — 재등록은 기존 행 status 복구로 처리.
-- 자리표시 비밀번호('00000000000', 일괄 등록의 형식 오류 행)는 제외:
-- 같은 이름의 다른 학생이 둘 다 번호 미확인일 수 있다.
-- 재실행 안전: IF NOT EXISTS 로 멱등.
-- ============================================================

-- 사전 점검: 위반 행이 있으면 인덱스 생성이 실패한다. 0행이어야 함.
SELECT name, password, count(*), array_agg(id)
  FROM users
 WHERE role = 'student' AND password <> '00000000000'
 GROUP BY name, password
HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS users_student_name_phone_key
  ON users (name, password)
 WHERE role = 'student' AND password <> '00000000000';
