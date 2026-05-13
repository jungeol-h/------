-- ============================================================
-- 테스트 계정 시드 — 황준걸 중1/중2/중3
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN
-- ------------------------------------------------------------
-- login_id   : 한글 이름 (황준걸중1 / 황준걸중2 / 황준걸중3)
-- password   : 01052526920 (전화번호)
-- 생년월일은 별도 컬럼이 없어 비고용으로만 기록 (20000313)
-- ============================================================

-- 기존 테스트 계정 제거 (재실행 안전)
delete from quiz_attempts  where student_id in ('s-test-g1','s-test-g2','s-test-g3');
delete from assignments    where student_id in ('s-test-g1','s-test-g2','s-test-g3');
delete from users          where id          in ('s-test-g1','s-test-g2','s-test-g3');

insert into users
  (id,           login_id,    password,      name,         role,      school,   grade,  class_name, parent_password, self_index, risk_level)
values
  ('s-test-g1', '황준걸중1', '01052526920', '황준걸중1', 'student', '산청중', '중1', '중1',     '01052526920',   75,         'normal'),
  ('s-test-g2', '황준걸중2', '01052526920', '황준걸중2', 'student', '산청중', '중2', '중2',     '01052526920',   75,         'normal'),
  ('s-test-g3', '황준걸중3', '01052526920', '황준걸중3', 'student', '산청중', '중3', '중3',     '01052526920',   75,         'normal');
