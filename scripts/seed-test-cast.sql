-- ============================================================
-- 테스트 캐스트 시드 — 전 역할(7종) 개발·테스트 계정 (2026-07-29)
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN
-- ------------------------------------------------------------
-- 목적: 개발자(황준걸)와 Claude가 모든 역할·모든 페이지를 실DB에서
-- 테스트할 수 있는 상시 계정 세트. 로컬 dev의 빠른 로그인 패널
-- (LoginPage의 DevQuickLogin, import.meta.env.DEV 전용)과 세트.
--
-- 공통 비밀번호: 테스트1234 (아래 bcrypt 해시로 저장, password_changed_at
-- 지정으로 강제 재설정 모달 면제. 기존 황준걸중N의 전화번호 비밀번호도
-- 이 값으로 교체된다.)
--
-- 격리: 직원 캐스트(매니저·강사·컨설턴트·열람자)는 group_names=['테스트']
-- 로 스코프 — 실학생 데이터가 보이지 않고, 그룹 스코프가 걸린 실직원
-- 화면에도 테스트 학생이 섞이지 않는다. 테스트관리자는 역할 특성상
-- 전체 열람(무소속)이다. 테스트 학생 3명(황준걸중1~3)도 ['테스트'].
--
-- 재실행 안전: 전부 upsert(on conflict do update/nothing) — 테스트 중
-- 만든 상담·과제 등 FK 종속 기록을 delete cascade로 잃지 않는다.
-- ============================================================

-- 공통 비밀번호 '테스트1234'의 bcrypt 해시
-- (node -e "require('bcryptjs').hash('테스트1234',10).then(console.log)")
-- 아래 모든 행에 동일 적용.

-- ── 1. 테스트 학생 3명 — 기존 황준걸중1~3 재활용(있으면 갱신, 없으면 생성) ──
insert into users
  (id, login_id, password, password_changed_at, name, role, status,
   school, grade, class_name, phone, parent_phone, group_names, self_index, risk_level)
values
  ('s-test-g1', '황준걸중1', '$2b$10$TiPIOQxtH5c5Pco.5OQjVOUFKfuftSwwXfBuSaxOZ0d7fqmcrZo/m', now(),
   '황준걸중1', 'student', 'active', '산청중', '중1', '중1', '01000000001', '01000000010', array['테스트'], 75, 'normal'),
  ('s-test-g2', '황준걸중2', '$2b$10$TiPIOQxtH5c5Pco.5OQjVOUFKfuftSwwXfBuSaxOZ0d7fqmcrZo/m', now(),
   '황준걸중2', 'student', 'active', '산청중', '중2', '중2', '01000000002', '01000000010', array['테스트'], 75, 'normal'),
  ('s-test-g3', '황준걸중3', '$2b$10$TiPIOQxtH5c5Pco.5OQjVOUFKfuftSwwXfBuSaxOZ0d7fqmcrZo/m', now(),
   '황준걸중3', 'student', 'active', '산청중', '중3', '중3', '01000000003', '01000000010', array['테스트'], 75, 'normal')
on conflict (id) do update set
  login_id = excluded.login_id,
  password = excluded.password,
  password_changed_at = excluded.password_changed_at,
  status = 'active',
  phone = excluded.phone,
  parent_phone = excluded.parent_phone,
  group_names = excluded.group_names;

-- ── 2. 직원·학부모 캐스트 6명 ──────────────────────────────
insert into users
  (id, login_id, password, password_changed_at, name, role, status, phone, subject, group_names)
values
  ('test-admin',      '테스트관리자',   '$2b$10$TiPIOQxtH5c5Pco.5OQjVOUFKfuftSwwXfBuSaxOZ0d7fqmcrZo/m', now(),
   '테스트관리자', 'admin', 'active', '01000000011', null, null),               -- 전체 열람
  ('test-manager',    '테스트매니저',   '$2b$10$TiPIOQxtH5c5Pco.5OQjVOUFKfuftSwwXfBuSaxOZ0d7fqmcrZo/m', now(),
   '테스트매니저', 'manager', 'active', '01000000012', null, array['테스트']),
  ('test-instructor', '테스트강사',     '$2b$10$TiPIOQxtH5c5Pco.5OQjVOUFKfuftSwwXfBuSaxOZ0d7fqmcrZo/m', now(),
   '테스트강사', 'instructor', 'active', '01000000013', '수학', array['테스트']),
  ('test-consultant', '테스트컨설턴트', '$2b$10$TiPIOQxtH5c5Pco.5OQjVOUFKfuftSwwXfBuSaxOZ0d7fqmcrZo/m', now(),
   '테스트컨설턴트', 'consultant', 'active', '01000000014', null, array['테스트']),
  ('test-viewer',     '테스트열람자',   '$2b$10$TiPIOQxtH5c5Pco.5OQjVOUFKfuftSwwXfBuSaxOZ0d7fqmcrZo/m', now(),
   '테스트열람자', 'viewer', 'active', '01000000015', null, array['테스트']),
  ('test-parent',     '테스트학부모',   '$2b$10$TiPIOQxtH5c5Pco.5OQjVOUFKfuftSwwXfBuSaxOZ0d7fqmcrZo/m', now(),
   '테스트학부모', 'parent', 'active', '01000000010', null, null)               -- 스코프는 자녀 링크가 결정
on conflict (id) do update set
  login_id = excluded.login_id,
  password = excluded.password,
  password_changed_at = excluded.password_changed_at,
  status = 'active',
  phone = excluded.phone,
  subject = excluded.subject,
  group_names = excluded.group_names;

-- ── 3. 학부모 ↔ 자녀 링크 (테스트학부모의 3자녀) ──────────
insert into parent_children (id, parent_id, student_id) values
  ('pc-test-1', 'test-parent', 's-test-g1'),
  ('pc-test-2', 'test-parent', 's-test-g2'),
  ('pc-test-3', 'test-parent', 's-test-g3')
on conflict (parent_id, student_id) do nothing;

-- ── 4. 강사·컨설턴트 ↔ 학생 배정 ──────────────────────────
insert into assignments (student_id, educator_id)
select s, e from
  (values ('s-test-g1'), ('s-test-g2'), ('s-test-g3')) as st(s),
  (values ('test-instructor'), ('test-consultant')) as ed(e)
on conflict (student_id, educator_id) do nothing;

-- ── 5. 출결 시간표 (평일 15:00~21:00) — 키오스크 지각·조퇴 판정 테스트용 ──
-- 기존 시간표가 있으면 건드리지 않는다 (center_save_hours 파생분 보호).
insert into attendance_schedules (id, student_id, day_of_week, arrival_time, departure_time)
select 'as-' || st.s || '-' || d, st.s, d, time '15:00', time '21:00'
from (values ('s-test-g1'), ('s-test-g2'), ('s-test-g3')) as st(s),
     generate_series(1, 5) as d
on conflict (student_id, day_of_week) do nothing;

-- ── 적용 확인 ──────────────────────────────────────────────
-- select login_id, role, phone, group_names, password_changed_at is not null as pw_set
--   from users where id like 'test-%' or id like 's-test-%' order by role;
