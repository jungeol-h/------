-- 교직원 업무일정(work_schedule) 컬럼 — 보고서(월간 컨설팅/수업) 헤더의 '업무일정'
-- 기본값 공급용. 담당업무는 기존 users.subject를 쓴다.
-- 멱등: 재실행 안전. 2026-08-01 클라이언트 제공 실데이터 시드 포함.

ALTER TABLE users ADD COLUMN IF NOT EXISTS work_schedule TEXT;

-- 교직원별 담당·업무일정 (2026-08-01 클라이언트 확정 — 황광희 카톡)
UPDATE users SET subject = '영어',              work_schedule = '금 16:00~21:00 · 일 13:30~18:00'        WHERE id = 't03';     -- 김승범
UPDATE users SET subject = '수학',              work_schedule = '토 13:30~18:00 · 일 12:30~19:00'        WHERE id = 't02';     -- 최돈권
UPDATE users SET subject = '과학',              work_schedule = '토 12:30~19:00'                          WHERE id = 't04';     -- 박영균
UPDATE users SET                                 work_schedule = '월·화 16:00~21:00 · 토·일 12:30~19:00' WHERE id = 'a-hwang'; -- 황광희 (담당 국어 기존 유지)
UPDATE users SET subject = '비교과 계열심화 자연', work_schedule = '목 13:00~19:00'                       WHERE id = 'cs01';    -- 김재형
UPDATE users SET subject = '비교과 계열심화 인문', work_schedule = '금 10:00~16:00'                       WHERE id = 'cs02';    -- 이승구
