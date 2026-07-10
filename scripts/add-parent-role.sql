-- ============================================================
-- 학부모(parent) 역할 — parent_children 매핑 테이블 마이그레이션
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN
-- ------------------------------------------------------------
-- 용도:
--  학부모 계정(users.role='parent')과 자녀 학생(users.role='student')의
--  M:N 매핑. 학부모 1명이 여러 자녀를, 자녀 1명이 여러 학부모 계정을 가질 수 있다.
--  users.role은 TEXT(CHECK 없음)이라 'parent' 값 추가에 스키마 변경 불필요.
-- ------------------------------------------------------------
-- 주의: RLS를 켜고 anon 정책을 누락하면 클라이언트가 빈 결과만 받고
--       침묵 실패한다. 정책 생성은 필수. (add-task-assigner-and-programs.sql 참고)
-- 재실행 안전: CREATE TABLE IF NOT EXISTS / drop policy if exists 로 멱등하게 작성됨.
-- ============================================================

create table if not exists parent_children (
  id          text primary key,
  parent_id   text not null references users(id) on delete cascade,
  student_id  text not null references users(id) on delete cascade,
  created_at  timestamptz default now(),
  unique(parent_id, student_id)
);

-- ── RLS enable + anon_all 정책 (누락 시 침묵 실패) ──────────
alter table parent_children enable row level security;

drop policy if exists "anon_all" on parent_children;

create policy "anon_all" on parent_children for all to anon using (true) with check (true);
