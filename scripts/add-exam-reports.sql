-- ============================================================
-- 내신백서 (2026-10) — 시험 후 피드백·시험지 분석·우수사례
--   1) exam_feedbacks   — 학생별 시험 후 피드백 (학생/강사 작성, 시험당 1건)
--   2) exam_analyses    — 학교·학년·과목·시험별 시험지 분석 (공동 작성, 시험당 1건)
--   3) exam_best_cases  — 우수사례
--   4) Storage 'exam-papers' 버킷 — 시험지 첨부 (이미지+PDF)
-- 재실행 안전: IF NOT EXISTS / drop policy 후 재생성으로 멱등.
-- 코드 배포 전에 먼저 적용해도 무해(신규 테이블은 구 코드가 안 씀).
-- ============================================================

-- exam_type: mid(중간) | final(기말)
-- subjects: [{subject, prevScore, targetScore, score, perfScore, perfMax, satisfaction(1-5), good, improve}]
create table if not exists exam_feedbacks (
  id              text primary key,
  student_id      text not null references users(id) on delete cascade,
  exam_year       int  not null,
  semester        int  not null check (semester in (1, 2)),
  exam_type       text not null check (exam_type in ('mid', 'final')),
  school          text default '',
  grade           text default '',
  class_name      text default '',            -- 작성 시점 스냅샷
  written_date    date,
  subjects        jsonb not null default '[]',
  action_plan     text default '',            -- 핵심 실천과제
  updated_by      text,
  updated_by_name text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create unique index if not exists uq_exam_feedbacks_key
  on exam_feedbacks(student_id, exam_year, semester, exam_type);

-- sections: {typeAnalysis, diffHigh/diffMid/diffLow:{items,count}, diffBasis,
--            hardest:{no,points,concept,summary,reason}, prep:{priority,materials,practice}, wrongNote}
-- attachments: [{ path, name, size }] — 실파일은 Storage 'exam-papers'
create table if not exists exam_analyses (
  id              text primary key,
  school          text not null,
  grade           text not null,
  subject         text not null,
  exam_year       int  not null,
  semester        int  not null check (semester in (1, 2)),
  exam_type       text not null check (exam_type in ('mid', 'final')),
  exam_date       date,
  start_time      text default '',
  end_time        text default '',
  publisher       text default '',
  total_questions int,
  difficulty      text default '',            -- 상 | 중 | 하
  question_types  jsonb default '[]',
  scope           text default '',
  sections        jsonb default '{}',
  attachments     jsonb default '[]',
  author_id       text,                       -- 최초 작성자
  updated_by      text,
  updated_by_name text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create unique index if not exists uq_exam_analyses_key
  on exam_analyses(school, grade, subject, exam_year, semester, exam_type);

create table if not exists exam_best_cases (
  id          text primary key,
  student_id  text not null references users(id) on delete cascade,
  author_id   text,
  author_name text,
  exam_year   int  not null,
  semester    int  not null check (semester in (1, 2)),
  exam_type   text not null check (exam_type in ('mid', 'final')),
  subject     text default '',
  score       text default '',
  prep_period text default '',
  process     text default '',                -- 학습 과정 요약
  key_point   text default '',                -- 성공 포인트
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists idx_exam_best_cases_student on exam_best_cases(student_id);

-- ── Storage 버킷: 시험지 첨부 ───────────────────────────────
-- public — 앱 전체가 anon 키 + anon_all RLS 체계 (quiz-attachments와 동일 근거).
insert into storage.buckets (id, name, public)
values ('exam-papers', 'exam-papers', true)
on conflict (id) do nothing;

drop policy if exists "anon_all_exam_papers" on storage.objects;
create policy "anon_all_exam_papers" on storage.objects
  for all to anon
  using (bucket_id = 'exam-papers')
  with check (bucket_id = 'exam-papers');

-- ── RLS enable + anon_all 정책 (누락 시 침묵 실패) ──────────
alter table exam_feedbacks  enable row level security;
alter table exam_analyses   enable row level security;
alter table exam_best_cases enable row level security;

drop policy if exists "anon_all" on exam_feedbacks;
drop policy if exists "anon_all" on exam_analyses;
drop policy if exists "anon_all" on exam_best_cases;

create policy "anon_all" on exam_feedbacks  for all to anon using (true) with check (true);
create policy "anon_all" on exam_analyses   for all to anon using (true) with check (true);
create policy "anon_all" on exam_best_cases for all to anon using (true) with check (true);
