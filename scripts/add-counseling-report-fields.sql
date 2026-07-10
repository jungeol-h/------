-- ============================================================
-- 상담 기록 보고서 양식 6단계 필드 마이그레이션
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN
-- ------------------------------------------------------------
-- 용도 (2026-07 클라이언트 확정 "상담 유형 6종 + 내용 6단계", 내부/외부 동일):
--  counseling_records / program_counseling_records 에
--  topic(상담주제) · diagnosis(진단) · advice(조언) · follow_up(후속조치)
--  · note(특이사항) · next_appointment(다음상담예약) 추가.
--
--  * content 컬럼은 유지 — 신규 기록도 6필드 합성 텍스트를 함께 저장한다
--    (NOT NULL 유지, PDF·레거시 소비처 호환). 구 기록은 6필드 NULL로 남는다.
--  * type 값 체계 교체(career_path/assessment/subject_learning/self_directed/
--    adjustment/etc)는 앱 레벨 변경이라 DB 마이그레이션 불필요 — 구 값
--    (study/career/habit/mind/etc)은 라벨만 유지해 표시된다.
-- ------------------------------------------------------------
-- 재실행 안전: 전부 ADD COLUMN IF NOT EXISTS 로 멱등하게 작성됨.
-- RLS: 대상 테이블 모두 기존 anon 전체 정책(for all)이라 추가 정책 불필요.
-- ============================================================

-- ── 내부(재원생) 상담 ───────────────────────────────────────
alter table counseling_records add column if not exists topic text;
alter table counseling_records add column if not exists diagnosis text;
alter table counseling_records add column if not exists advice text;
alter table counseling_records add column if not exists follow_up text;
alter table counseling_records add column if not exists note text;
alter table counseling_records add column if not exists next_appointment text;

-- ── 외부(외생) 상담 ─────────────────────────────────────────
alter table program_counseling_records add column if not exists topic text;
alter table program_counseling_records add column if not exists diagnosis text;
alter table program_counseling_records add column if not exists advice text;
alter table program_counseling_records add column if not exists follow_up text;
alter table program_counseling_records add column if not exists note text;
alter table program_counseling_records add column if not exists next_appointment text;
