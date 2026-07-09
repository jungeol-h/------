-- ============================================================
-- 외생(외부) 상담 프로그램 시드 — 프로그램 1건 + 학생 명단 템플릿
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN
-- ------------------------------------------------------------
-- 선행: scripts/add-task-assigner-and-programs.sql 를 먼저 실행해
--       counseling_programs / program_students 테이블과 RLS 정책이
--       존재해야 한다.
-- 재실행 안전: on conflict (id) do nothing 으로 멱등하게 작성됨.
--       상담 기록(program_counseling_records)은 앱에서 작성하므로
--       이 스크립트에서 건드리지 않는다 (delete 금지 — 기록 소실 방지).
-- ============================================================

-- ── 1) 프로그램 1건 ─────────────────────────────────────────
insert into counseling_programs (id, name, year, status)
values ('cp-2026-andong', '2026 안동 진로진학 외부상담', 2026, 'active')
on conflict (id) do nothing;

-- ── 2) 외부 학생 명단 ───────────────────────────────────────
-- 명단(130명)은 수령 후 아래 형식으로 채운다.
-- id 규칙: 'ps-andong-001' 처럼 프로그램별 순번을 권장 (충돌 방지).
-- 앱의 "학생 등록"(admin 붙여넣기 임포트)으로도 등록 가능하므로,
-- SQL 대량 등록이 필요할 때만 아래 템플릿을 사용한다.
--
-- 예시 (주석 해제 후 실제 명단으로 교체):
--
-- insert into program_students (id, program_id, name, school, grade) values
--   ('ps-andong-001', 'cp-2026-andong', '홍길동', '안동중',  '중2'),
--   ('ps-andong-002', 'cp-2026-andong', '김철수', '풍산중',  '중3'),
--   ('ps-andong-003', 'cp-2026-andong', '이영희', '경안중',  '중1'),
--   ('ps-andong-004', 'cp-2026-andong', '박민준', '안동중',  '중2')
-- on conflict (id) do nothing;
