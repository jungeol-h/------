-- ============================================================
-- 과제 부여자 컬럼 + 외생(외부) 상담 프로그램 3테이블 마이그레이션
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN
-- ------------------------------------------------------------
-- 용도:
--  1) tasks.assigner_id  — 과제를 부여한 교육자 id (교과강사/컨설턴트 부여분 추적)
--  2) 외생 상담 프로그램  — 재원생 데이터와 완전 분리된 3테이블
--     (10~11월 안동 센터 외부 학생 대상 1회성 상담. 기존 counseling_records 미오염)
-- ------------------------------------------------------------
-- 주의: RLS를 켜고 anon 정책을 누락하면 클라이언트가 빈 결과만 받고
--       침묵 실패한다. 정책 생성은 필수. (patch-quiz-rls.sql 참고)
-- 재실행 안전: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS /
--       drop policy if exists 로 멱등하게 작성됨.
-- ============================================================

-- ── 1) 과제 부여자 컬럼 (additive) ──────────────────────────
alter table tasks add column if not exists assigner_id text;

-- ── 2) 외생 상담 프로그램 3테이블 ──────────────────────────
create table if not exists counseling_programs (
  id          text primary key,
  name        text not null,
  year        int,
  status      text default 'active',
  created_at  timestamptz default now()
);

create table if not exists program_students (
  id          text primary key,
  program_id  text not null references counseling_programs(id) on delete cascade,
  name        text not null,
  school      text,
  grade       text,
  memo        text,
  created_at  timestamptz default now()
);

create table if not exists program_counseling_records (
  id                  text primary key,
  program_student_id  text not null references program_students(id) on delete cascade,
  counselor_id        text references users(id),
  date                date not null,
  content             text not null,
  type                text default 'career',
  created_at          timestamptz default now()
);

-- ── 3) RLS enable + anon_all 정책 (누락 시 침묵 실패) ──────────
alter table counseling_programs         enable row level security;
alter table program_students            enable row level security;
alter table program_counseling_records  enable row level security;

drop policy if exists "anon_all" on counseling_programs;
drop policy if exists "anon_all" on program_students;
drop policy if exists "anon_all" on program_counseling_records;

create policy "anon_all" on counseling_programs        for all to anon using (true) with check (true);
create policy "anon_all" on program_students           for all to anon using (true) with check (true);
create policy "anon_all" on program_counseling_records for all to anon using (true) with check (true);
