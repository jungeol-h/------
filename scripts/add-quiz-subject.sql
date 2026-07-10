-- ============================================================
-- quiz_sets.subject(과목) 추가 — 과목별 확인평가 (국어/영어/수학/과학)
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN
-- ------------------------------------------------------------
-- 용도: 강사별 과목 출제. 강사는 자기 과목(users.subject) 회차만
--  보고 출제하며, 관리자는 4과목 모두 출제 가능하다.
--  기존 회차는 전부 국어이므로 default '국어'로 자동 백필된다.
--
-- 선행: add-user-subject.sql (강사 users.subject 시드) 먼저 실행.
-- ------------------------------------------------------------
-- 재실행 안전: ADD COLUMN IF NOT EXISTS + UPDATE 멱등.
-- ============================================================

alter table quiz_sets add column if not exists subject text not null default '국어';

-- ── 관리자(황광희)는 총괄 겸 국어 강사 — 출제 기본 과목 '국어' ──
update users set subject = '국어' where role = 'admin' and name = '황광희';
