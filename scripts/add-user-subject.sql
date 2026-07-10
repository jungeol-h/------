-- ============================================================
-- users.subject(담당 과목/분야) 추가 + 강사 계정 시드
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN
-- ------------------------------------------------------------
-- 용도: 상담 기록 작성자 표시에 과목 병기 — '이름(과목)' 형식.
--  subject가 NULL/빈 값이면 기존처럼 이름만 표시된다.
--  교직원 수정 UI가 없어 값 변경은 이 스크립트(또는 SQL 직접 수정)로 한다.
--
-- 시드 값은 seed-staff-accounts.sql의 분야 주석 기준 — 실제와 다르면 수정 후 실행.
-- ------------------------------------------------------------
-- 재실행 안전: ADD COLUMN IF NOT EXISTS + UPDATE 멱등.
-- ============================================================

alter table users add column if not exists subject text;

-- ── instructor (교과강사) ──────────────────────────────────
update users set subject = '수학' where login_id in ('t01', 't02');
update users set subject = '영어' where login_id = 't03';
update users set subject = '과학' where login_id = 't04';

-- ── consultant (컨설턴트) ──────────────────────────────────
update users set subject = '비교과(자연)' where login_id = 'cs01';
update users set subject = '비교과(인문)' where login_id = 'cs02';
update users set subject = '진로진학'     where login_id = 'cs03';
