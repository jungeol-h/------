-- 학습 계획 카드 드래그 정렬용 순서 컬럼.
-- 운영 DB에 1회 실행. 재실행 안전.

ALTER TABLE learning_records
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY student_id, date, record_type
      ORDER BY created_at NULLS LAST, id
    ) AS rn
  FROM learning_records
  WHERE record_type = 'planner'
)
UPDATE learning_records lr
SET sort_order = ordered.rn
FROM ordered
WHERE lr.id = ordered.id
  AND lr.sort_order IS NULL;
