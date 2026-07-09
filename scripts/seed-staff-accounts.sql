-- ============================================================
-- 구성원(교직원) 계정 시드 — 교과강사·컨설턴트·열람자 9명 + 총괄 admin 1명
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN
-- ------------------------------------------------------------
-- 관례:
--   login_id : 한글 이름
--   password : 하이픈 제거한 전화번호
-- 역할:
--   instructor(교과강사) : 과제 부여 · 확인평가 · 상담 · 열람
--   consultant(컨설턴트) : 과제 부여 · 상담 · 열람 · 외생 상담
--   viewer(열람자)       : 전체 열람 + 리포트 출력만
-- ------------------------------------------------------------
-- 재실행 안전: t01~t04 / cs01~cs03 / v01,v02 는 delete 후 insert.
-- ⚠ 황광희(총괄 admin)는 기존 계정이 이미 존재할 수 있고, users 행을
--   삭제하면 counseling_records 등 FK CASCADE로 상담 기록이 소실되므로
--   절대 delete 하지 않는다. where not exists 조건부 insert만 수행한다.
-- ============================================================

-- 교직원 계정 제거 (재실행 안전) — admin(황광희) 제외
delete from users where id in (
  't01','t02','t03','t04',
  'cs01','cs02','cs03',
  'v01','v02'
);

insert into users (id, login_id, password, name, role, status) values
  -- ── instructor (교과강사) ──────────────────────────────
  ('t01',  '양호준', '01022955605', '양호준', 'instructor', 'active'),  -- 수학컨설팅
  ('t02',  '최돈권', '01028197680', '최돈권', 'instructor', 'active'),  -- 수학컨설팅
  ('t03',  '김승범', '01062295303', '김승범', 'instructor', 'active'),  -- 영어컨설팅
  ('t04',  '박영균', '01040074916', '박영균', 'instructor', 'active'),  -- 과학컨설팅
  -- ── consultant (컨설턴트) ──────────────────────────────
  ('cs01', '김재형', '01023707602', '김재형', 'consultant', 'active'),  -- 비교과 특강-자연
  ('cs02', '이승구', '01050640038', '이승구', 'consultant', 'active'),  -- 비교과 특강-인문
  ('cs03', '최인선', '01094862012', '최인선', 'consultant', 'active'),  -- 진로진학컨설팅
  -- ── viewer (열람자) ────────────────────────────────────
  ('v01',  '이정화', '01043270102', '이정화', 'viewer', 'active'),      -- 슈퍼바이저
  ('v02',  '이화연', '01093687029', '이화연', 'viewer', 'active');      -- 공무원

-- ── 황광희(총괄, admin) — 조건부 insert (기존 계정 보존) ──────────
-- 010-6839-3910. 기존 admin 계정이 있으면 건드리지 않는다.
insert into users (id, login_id, password, name, role, status)
select 'a-hwang', '황광희', '01068393910', '황광희', 'admin', 'active'
where not exists (
  select 1 from users where login_id = '황광희' or (role = 'admin' and name = '황광희')
);
