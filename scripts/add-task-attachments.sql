-- ============================================================
-- 과제 파일 첨부 (양방향)
-- 배경: 강사가 과제 낼 때 문제/자료 파일을 첨부하고,
--       학생이 과제를 파일로 제출하는 요구 (클라이언트 2026-07-22).
-- 사용: Supabase Studio → SQL Editor → RUN (코드 배포 전에 먼저 실행)
-- 재실행 안전: IF NOT EXISTS / on conflict do nothing / drop policy 후 재생성
-- ============================================================

-- ── 1) 강사 첨부 메타 [{ path, name, size }] — 과제 부여 시 문제/자료 ──
alter table tasks add column if not exists attachments jsonb not null default '[]';

-- ── 2) 학생 제출 메타 [{ path, name, size, submittedAt }] — 과제 제출 파일 ──
alter table tasks add column if not exists submissions jsonb not null default '[]';

-- ── 3) Storage 버킷 — public (quiz-attachments·counseling-files와 동일 근거:
--       앱 전체가 anon 키 + anon_all RLS 체계라 private 전환의 실익 없음) ──
insert into storage.buckets (id, name, public)
values ('task-files', 'task-files', true)
on conflict (id) do nothing;

drop policy if exists "anon_all_task_files" on storage.objects;
create policy "anon_all_task_files" on storage.objects
  for all to anon
  using (bucket_id = 'task-files')
  with check (bucket_id = 'task-files');
