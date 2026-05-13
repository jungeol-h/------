-- ============================================================
-- quiz_* 테이블 RLS 정책 패치 (이미 seed-quiz-content.sql을 실행한 경우용)
-- 원인: RLS만 켜지고 anon 정책이 없으면 클라이언트가 빈 결과만 받음
-- ============================================================

alter table quiz_sets       enable row level security;
alter table quiz_questions  enable row level security;
alter table quiz_attempts   enable row level security;

drop policy if exists "anon_all" on quiz_sets;
drop policy if exists "anon_all" on quiz_questions;
drop policy if exists "anon_all" on quiz_attempts;

create policy "anon_all" on quiz_sets       for all to anon using (true) with check (true);
create policy "anon_all" on quiz_questions  for all to anon using (true) with check (true);
create policy "anon_all" on quiz_attempts   for all to anon using (true) with check (true);
