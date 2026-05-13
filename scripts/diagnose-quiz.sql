-- ============================================================
-- 확인평가가 학생 화면에 안 뜨는 원인 진단 SQL
-- Supabase Studio → SQL Editor에서 각 블록을 RUN해서 결과 확인
-- ============================================================

-- 1) quiz_sets가 실제로 들어갔는지
select id, title, grade, round, is_published from quiz_sets order by grade, round;

-- 2) 학년별 문제 수가 40개씩 들어갔는지
select quiz_set_id, count(*) as q_count from quiz_questions group by quiz_set_id order by quiz_set_id;

-- 3) 학생 학년 표기가 quiz_sets.grade와 정확히 일치하는지
--    (한쪽이 '중1'인데 다른쪽이 '중 1' 또는 '중1 ' 같으면 안 잡힘)
select distinct grade as student_grade, length(grade) as len
from users where role = 'student' order by grade;
select distinct grade as quiz_grade, length(grade) as len
from quiz_sets order by grade;

-- 4) RLS 상태 확인 (true면 정책 없을 때 anon 읽기 차단)
select schemaname, tablename, rowsecurity
from pg_tables
where tablename in ('quiz_sets','quiz_questions','quiz_attempts','users');

-- 5) anon 권한으로 quiz_sets에 SELECT 가능한지 (정책 목록)
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where tablename in ('quiz_sets','quiz_questions','quiz_attempts');
