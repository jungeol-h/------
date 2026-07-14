-- ============================================================
-- 사용자 그룹(소속) 도입 — users.group_names + 기록 테이블 group_name
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN
-- ------------------------------------------------------------
-- 용도: 사용자를 그룹(산청우정학사 / 안동NAVI / 깨알)으로 분류.
--  - 학생: 단일 소속 (1원소 배열)
--  - 직원: 복수 소속 가능 (배열)
--  - group_names가 NULL/빈 배열인 직원 = 전체 열람 (admin 포함)
--  - 학생 참조 없는 기록(관리보고·재정·긴급보고)은 group_name 컬럼으로
--    작성 시점의 소속을 기록. NULL = 공용(전 그룹에서 보임, 기존 데이터 하위호환).
--
-- 백필 근거 (2026-07-14 클라이언트 협의):
--  - 학생 전원 → 산청우정학사 (현재 재원생 전부 산청)
--  - instructor·consultant 전원 → 안동NAVI ("현재 등록된 모든 강사들은 안동NAVI만")
--  - manager·viewer → 산청우정학사 (현재 운영 주체가 산청이라는 가정 — 다르면 수정 후 실행)
--  - admin(a-hwang, a01) → NULL 유지 = 전체 열람
-- ------------------------------------------------------------
-- 재실행 안전: ADD COLUMN IF NOT EXISTS + group_names IS NULL 조건부 UPDATE 멱등.
-- ============================================================

alter table users add column if not exists group_names text[];

alter table management_reports add column if not exists group_name text;
alter table finance_records    add column if not exists group_name text;
alter table urgent_reports     add column if not exists group_name text;

-- ── 백필 (group_names가 비어 있는 사용자만 — 이후 수동 지정을 덮어쓰지 않는다) ──
update users set group_names = array['산청우정학사']
 where role = 'student' and group_names is null;

update users set group_names = array['안동NAVI']
 where role in ('instructor', 'consultant') and group_names is null;

update users set group_names = array['산청우정학사']
 where role in ('manager', 'viewer') and group_names is null;
