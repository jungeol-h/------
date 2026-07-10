-- ============================================================
-- 2026-07 클라이언트 요청사항(우선 순위 상세 정리.hwpx) 잔여분 마이그레이션
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN
-- ------------------------------------------------------------
-- 포함:
--  1) login_logs          — 학생 홈 배너 로그인 횟수 (우선순위 1-①)
--  2) learning_records.start_time — 오늘의 학습계획표 부채꼴 타임테이블 (1-②)
--  3) daily_self_scores   — 돌아보기 "오늘의 자기주도 학습 점수" (1-④)
--  4) work_plans          — 관리자 업무계획 탭 + 홈 '오늘의 업무 일정' (2-④⑤)
--  5) urgent_reports      — 강사→관리자 긴급 보고·건의 (2-③, 인앱만)
-- ------------------------------------------------------------
-- 재실행 안전: 전부 IF NOT EXISTS / drop policy 후 재생성으로 멱등.
-- 코드 배포 전에 먼저 적용해도 무해(신규 컬럼·테이블은 구 코드가 안 씀).
-- ============================================================

-- ── 1) 로그인 기록 ──────────────────────────────────────────
-- 카운터 컬럼 대신 로그 테이블: supabase-js로 원자적 increment가 불가하고
-- (read-then-write 레이스), 로그면 기간별 집계로 확장 가능. 표시는 count head 쿼리.
create table if not exists login_logs (
  id          bigserial primary key,
  user_id     text not null references users(id) on delete cascade,
  created_at  timestamptz default now()
);
create index if not exists idx_login_logs_user on login_logs(user_id);

-- ── 2) 계획 시작 시각 (선택 입력) ───────────────────────────
alter table learning_records add column if not exists start_time time;

-- ── 3) 일일 자기주도 학습 점수 (100점 자기평가 + 메모) ──────
create table if not exists daily_self_scores (
  id          text primary key,
  student_id  text not null references users(id) on delete cascade,
  date        date not null,
  score       integer not null check (score between 0 and 100),
  memo        text default '',
  created_at  timestamptz default now(),
  unique (student_id, date)
);

-- ── 4) 업무계획 ─────────────────────────────────────────────
-- types: 상담 유형 키 배열(중복 체크 가능) — 앱의 COUNSELING_TYPES 체계.
-- student_ids: 대상 학생 복수 허용(그룹 상담·설명회). 60명 규모라
-- 조인 테이블 없이 jsonb 배열 + 클라이언트 계산으로 충분.
create table if not exists work_plans (
  id          text primary key,
  author_id   text not null references users(id) on delete cascade,
  plan_date   date not null,
  plan_time   text default '',            -- 'HH:MM' (tasks.due_time 관례)
  types       jsonb not null default '[]',
  student_ids jsonb not null default '[]',
  memo        text default '',
  created_at  timestamptz default now()
);
create index if not exists idx_work_plans_date on work_plans(plan_date);

-- ── 5) 긴급 보고·건의 ──────────────────────────────────────
create table if not exists urgent_reports (
  id            text primary key,
  author_id     text not null references users(id) on delete cascade,
  content       text not null,
  confirmed     boolean default false,
  confirmed_by  text references users(id),
  confirmed_at  timestamptz,
  created_at    timestamptz default now()
);

-- ── RLS enable + anon_all 정책 (누락 시 침묵 실패) ──────────
alter table login_logs         enable row level security;
alter table daily_self_scores  enable row level security;
alter table work_plans         enable row level security;
alter table urgent_reports     enable row level security;

drop policy if exists "anon_all" on login_logs;
drop policy if exists "anon_all" on daily_self_scores;
drop policy if exists "anon_all" on work_plans;
drop policy if exists "anon_all" on urgent_reports;

create policy "anon_all" on login_logs        for all to anon using (true) with check (true);
create policy "anon_all" on daily_self_scores for all to anon using (true) with check (true);
create policy "anon_all" on work_plans        for all to anon using (true) with check (true);
create policy "anon_all" on urgent_reports    for all to anon using (true) with check (true);
