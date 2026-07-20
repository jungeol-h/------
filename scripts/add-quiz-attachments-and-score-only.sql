-- ============================================================
-- 확인평가 확장: 문제 첨부(이미지/PDF) + 점수전용(외부시험) 회차
-- 배경: 수학은 별도 시험앱으로 응시 — 강사가 문제를 첨부로 올리고
--       회차별 점수를 직접 입력하는 요구 (클라이언트 2026-07-20).
-- 사용: Supabase Studio → SQL Editor → RUN (코드 배포 전에 먼저 실행)
-- 재실행 안전: IF NOT EXISTS / on conflict do nothing / drop policy 후 재생성
-- ============================================================

-- ── 1) 문제 첨부 메타 [{ path, name, size }] — 실파일은 Storage ──
alter table quiz_questions add column if not exists attachments jsonb not null default '[]';

-- ── 2) 점수전용 회차 (문제 없이 점수만 기록, max_score = 만점) ──
alter table quiz_sets add column if not exists is_score_only boolean not null default false;
alter table quiz_sets add column if not exists max_score int;

-- ── 3) Storage 버킷 — public (counseling-files와 동일 근거: 앱 전체가
--       anon 키 + anon_all RLS 체계라 private 전환의 실익 없음) ──
insert into storage.buckets (id, name, public)
values ('quiz-attachments', 'quiz-attachments', true)
on conflict (id) do nothing;

drop policy if exists "anon_all_quiz_attachments" on storage.objects;
create policy "anon_all_quiz_attachments" on storage.objects
  for all to anon
  using (bucket_id = 'quiz-attachments')
  with check (bucket_id = 'quiz-attachments');
