-- ============================================================
-- 2026-07 업무기록 통합 탭 마이그레이션
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN
-- ------------------------------------------------------------
-- 포함:
--  1) work_plans.status              — 업무별 진행 상황 (예정/진행중/완료)
--  2) counseling_records 시작·종료시간 — 상담보고 시간 입력란
--  3) management_reports             — 관리보고 (admin 전용 작성)
--  4) finance_records                — 재정 (admin 전용 작성, 영수증 첨부)
--  5) lesson_reports                 — 수업보고 (매니저·강사·컨설턴트·admin)
--  6) Storage 'finance-receipts' 버킷 — 영수증·사진 (이미지+PDF)
-- ------------------------------------------------------------
-- 재실행 안전: 전부 IF NOT EXISTS / drop policy 후 재생성으로 멱등.
-- 코드 배포 전에 먼저 적용해도 무해(신규 컬럼·테이블은 구 코드가 안 씀).
-- ============================================================

-- ── 1) 업무계획 진행 상황 ───────────────────────────────────
-- planned(예정) | in_progress(진행중) | done(완료)
alter table work_plans add column if not exists status text not null default 'planned';

-- ── 2) 상담보고 시작·종료시간 ('HH:MM' — work_plans.plan_time 관례) ──
alter table counseling_records add column if not exists start_time text default '';
alter table counseling_records add column if not exists end_time   text default '';

-- ── 3) 관리보고 ─────────────────────────────────────────────
-- work_type: instructor_mgmt(강사관리) | operation_schedule(운영일정관리)
--            | inquiry(문의처리) | event(행사진행) | meeting(회의) | etc(기타)
create table if not exists management_reports (
  id          text primary key,
  author_id   text not null references users(id) on delete cascade,
  date        date not null,
  work_type   text not null default 'etc',
  start_time  text default '',
  end_time    text default '',
  content     text default '',            -- 세부내용
  note        text default '',            -- 특이사항
  created_at  timestamptz default now()
);
create index if not exists idx_management_reports_date on management_reports(date);

-- ── 4) 재정 ─────────────────────────────────────────────────
-- category: snack(간식) | supplies(비품) | textbook(교재) | teaching_aid(교구) | etc(기타)
-- payment_method: personal_card(개인카드) | cash(현금)
-- attachments: [{ path, name, size }] — 실파일은 'finance-receipts' 버킷.
create table if not exists finance_records (
  id             text primary key,
  author_id      text not null references users(id) on delete cascade,
  date           date not null,
  category       text not null default 'etc',
  item_name      text default '',         -- 물품명
  unit_price     integer default 0,       -- 단가(원)
  quantity       integer default 1,       -- 갯수
  amount         integer default 0,       -- 금액(원)
  vendor         text default '',         -- 구입처
  payment_method text not null default 'personal_card',
  attachments    jsonb not null default '[]',
  created_at     timestamptz default now()
);
create index if not exists idx_finance_records_date on finance_records(date);

-- ── 5) 수업보고 ─────────────────────────────────────────────
-- student_ids: 참여학생(최대 10명 — 앱에서 검증). work_plans 관례의 jsonb 배열.
create table if not exists lesson_reports (
  id          text primary key,
  author_id   text not null references users(id) on delete cascade,
  date        date not null,
  student_ids jsonb not null default '[]',
  start_time  text default '',
  end_time    text default '',
  topic       text default '',            -- 수업주제
  textbook    text default '',            -- 수업교재
  content     text default '',            -- 수업내용
  homework    text default '',            -- 과제
  note        text default '',            -- 특이사항
  created_at  timestamptz default now()
);
create index if not exists idx_lesson_reports_date on lesson_reports(date);

-- ── 6) Storage 버킷: 영수증·사진 ────────────────────────────
-- public — 앱 전체가 anon 키 + anon_all RLS 체계라 private+서명URL로
-- 바꿔도 실질 보안 이득이 없다 (counseling-files와 동일, 보안 부채 재검토 대상).
insert into storage.buckets (id, name, public)
values ('finance-receipts', 'finance-receipts', true)
on conflict (id) do nothing;

drop policy if exists "anon_all_finance_receipts" on storage.objects;
create policy "anon_all_finance_receipts" on storage.objects
  for all to anon
  using (bucket_id = 'finance-receipts')
  with check (bucket_id = 'finance-receipts');

-- ── RLS enable + anon_all 정책 (누락 시 침묵 실패) ──────────
alter table management_reports enable row level security;
alter table finance_records    enable row level security;
alter table lesson_reports     enable row level security;

drop policy if exists "anon_all" on management_reports;
drop policy if exists "anon_all" on finance_records;
drop policy if exists "anon_all" on lesson_reports;

create policy "anon_all" on management_reports for all to anon using (true) with check (true);
create policy "anon_all" on finance_records    for all to anon using (true) with check (true);
create policy "anon_all" on lesson_reports     for all to anon using (true) with check (true);
