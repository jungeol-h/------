-- ============================================================
-- 서술형 문항 + 피상담자 유형 + 과제 상세 필드 + 입학일 마이그레이션
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN
-- ------------------------------------------------------------
-- 용도:
--  1) quiz_questions.type — 문항 유형 'short'(단답) | 'essay'(서술).
--     서술형은 accepted_answers를 빈 배열로 저장하고 교사가 수동 채점.
--  2) program_counseling_records.target_type — 피상담자 유형
--     'student'(학생) | 'mother'(학생 모) | 'father'(학생 부)
--  3) tasks.method / tasks.content — 과제 수행방법·과제 내용
--  4) users.enrolled_at — 입학일 (관리자 대시보드 '신입학' 집계용)
-- ------------------------------------------------------------
-- 재실행 안전: 전부 ADD COLUMN IF NOT EXISTS 로 멱등하게 작성됨.
-- RLS: 대상 테이블 모두 기존 anon 전체 정책(for all)이라 추가 정책 불필요.
-- ============================================================

-- ── 1) 확인평가 문항 유형 ───────────────────────────────────
alter table quiz_questions add column if not exists type text not null default 'short';

-- ── 2) 외부 상담 피상담자 유형 ──────────────────────────────
alter table program_counseling_records add column if not exists target_type text default 'student';

-- ── 3) 과제 수행방법 / 과제 내용 ────────────────────────────
alter table tasks add column if not exists method text;
alter table tasks add column if not exists content text;

-- ── 4) 입학일 ───────────────────────────────────────────────
alter table users add column if not exists enrolled_at date;
