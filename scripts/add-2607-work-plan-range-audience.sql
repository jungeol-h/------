-- ============================================================
-- 업무계획 개편: 시작~종료 시간 + 대상 복수선택 (2026-07-30 클라이언트 요청)
-- ------------------------------------------------------------
--  1) work_plans.plan_end_time — 종료 시간 'HH:MM' (plan_time과 같은 관례,
--     기존 plan_time은 시작 시간으로 의미가 좁아진다. 미입력은 '').
--  2) work_plans.audiences — 대상 복수선택 jsonb 배열.
--     값: student/parent/instructor/city_officer/admin (앱의 WORK_PLAN_AUDIENCES).
--     학생을 특정하지 않고 센터장 업무 상황만 기록하는 개편이라 student_ids는
--     더 이상 폼에서 쓰지 않지만, 구 기록 호환을 위해 컬럼은 유지한다.
-- ------------------------------------------------------------
-- 재실행 안전: add column if not exists로 멱등.
-- 코드 배포 전에 먼저 적용해도 무해(신규 컬럼은 구 코드가 안 씀).
-- ============================================================

alter table work_plans add column if not exists plan_end_time text not null default '';
alter table work_plans add column if not exists audiences jsonb not null default '[]';
