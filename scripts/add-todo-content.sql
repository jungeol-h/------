-- todo_items에 학습 내용(자유 텍스트) 컬럼 추가
-- 베타테스터 피드백: "오늘의 학습 계획에 학습 내용까지 기록할 수 있게 해 달라" (a01, 2026-05-11)
-- 운영 DB에 1회 실행. 재실행 안전.

ALTER TABLE todo_items
  ADD COLUMN IF NOT EXISTS content TEXT;
