-- ============================================================
-- 업무보고(상담 기록) PDF 파일 첨부 마이그레이션 (hwpx 우선순위 2-②)
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN
-- ------------------------------------------------------------
-- 1) counseling_records.attachments — [{ path, name, size }] jsonb 배열.
--    실제 파일은 Storage 'counseling-files' 버킷에 저장하고 여기엔 메타만 둔다.
-- 2) Storage 버킷 + 정책. 버킷은 public — 앱 전체가 anon 키 + anon_all RLS
--    체계라 private+서명URL로 바꿔도 실질 보안 이득이 없다
--    (보안 부채 정리 시 RLS와 함께 재검토).
-- ------------------------------------------------------------
-- 재실행 안전: IF NOT EXISTS / on conflict do nothing / drop policy 후 재생성.
-- ============================================================

-- ── 1) 첨부 메타 컬럼 ───────────────────────────────────────
alter table counseling_records add column if not exists attachments jsonb not null default '[]';

-- ── 2) Storage 버킷 ─────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('counseling-files', 'counseling-files', true)
on conflict (id) do nothing;

-- ── 3) Storage 정책 (anon 업로드/조회/삭제 — 기존 anon_all 체계와 동일) ──
drop policy if exists "anon_all_counseling_files" on storage.objects;
create policy "anon_all_counseling_files" on storage.objects
  for all to anon
  using (bucket_id = 'counseling-files')
  with check (bucket_id = 'counseling-files');
