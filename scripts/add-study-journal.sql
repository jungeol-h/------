-- ============================================================
-- 학습일지 첨부 마이그레이션 (2026-08-09 클라이언트 요청)
-- 배경: "학생 탭의 명단 항목에 학습일지 첨부 칸을 하나 더" —
--       학생별 학습일지 파일(이미지/PDF)을 명단에서 바로 올려두고 열람.
-- 방식: 프로젝트 관례(tasks.attachments 등)대로 부모 행 jsonb 메타 배열 +
--       public 버킷. 메타: [{ path, name, size, uploadedAt }]
-- 사용: Supabase Studio → SQL Editor → RUN (코드 배포 전에 먼저 실행)
-- 재실행 안전: IF NOT EXISTS / on conflict do nothing / drop policy 후 재생성
-- ============================================================

-- ── 1) users.study_journals — 학습일지 첨부 메타 ────────────
alter table users add column if not exists study_journals jsonb not null default '[]';

-- ── 2) Storage 버킷 — public (task-files와 동일 근거:
--       앱 전체가 anon 키 + anon_all RLS 체계라 private 전환의 실익 없음) ──
insert into storage.buckets (id, name, public)
values ('study-journals', 'study-journals', true)
on conflict (id) do nothing;

drop policy if exists "anon_all_study_journals" on storage.objects;
create policy "anon_all_study_journals" on storage.objects
  for all to anon
  using (bucket_id = 'study-journals')
  with check (bucket_id = 'study-journals');
