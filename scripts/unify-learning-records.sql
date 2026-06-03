-- 학습 계획/TODO와 타이머 기록을 learning_records 단일 원장으로 통합.
-- 운영 DB에 1회 실행. 재실행 안전.

ALTER TABLE learning_records
  ALTER COLUMN duration DROP NOT NULL,
  ALTER COLUMN focus DROP NOT NULL;

ALTER TABLE learning_records
  ADD COLUMN IF NOT EXISTS record_type TEXT NOT NULL DEFAULT 'timer',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'done',
  ADD COLUMN IF NOT EXISTS study_method TEXT,
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS planned_min INTEGER CHECK (planned_min IS NULL OR planned_min > 0),
  ADD COLUMN IF NOT EXISTS actual_duration INTEGER CHECK (actual_duration IS NULL OR actual_duration > 0),
  ADD COLUMN IF NOT EXISTS migrated_todo_id TEXT;

UPDATE learning_records
SET actual_duration = duration
WHERE actual_duration IS NULL
  AND duration IS NOT NULL;

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
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'learning_records_record_type_check'
  ) THEN
    ALTER TABLE learning_records
      ADD CONSTRAINT learning_records_record_type_check
      CHECK (record_type IN ('planner', 'timer')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'learning_records_status_check'
  ) THEN
    ALTER TABLE learning_records
      ADD CONSTRAINT learning_records_status_check
      CHECK (status IN ('pending', 'done')) NOT VALID;
  END IF;
END $$;
