-- 남아 있는 레거시 todo_items를 learning_records 계획 레코드로 이관.
-- 운영 DB에 1회 실행. migrated_todo_id와 생성 id 양쪽으로 중복을 방지해 재실행 안전.

INSERT INTO learning_records (
  id,
  student_id,
  date,
  subject,
  duration,
  focus,
  record_type,
  status,
  study_method,
  content,
  planned_min,
  actual_duration,
  migrated_todo_id,
  created_at
)
SELECT
  'lr_' || td.id,
  td.student_id,
  td.date,
  td.subject,
  NULL,
  NULL,
  'planner',
  CASE WHEN td.done THEN 'done' ELSE 'pending' END,
  NULL,
  td.content,
  td.planned_min,
  NULL,
  td.id,
  td.created_at
FROM todo_items td
WHERE NOT EXISTS (
    SELECT 1
    FROM learning_records lr
    WHERE lr.migrated_todo_id = td.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM learning_records lr
    WHERE lr.id = 'lr_' || td.id
  );
