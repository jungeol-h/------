-- ================================================================
-- 산청 우정학사 베타테스트 플랫폼 스키마
-- Supabase Dashboard > SQL Editor 에서 전체 실행
-- ================================================================

-- ----------------------------------------------------------------
-- 1. 사용자 테이블 (학생 + 교육자 통합)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,         -- 's001', 'm01', 'a01'
  login_id        TEXT UNIQUE NOT NULL,     -- 학생: 이름, 교육자: 아이디
  password        TEXT NOT NULL,            -- 학생: 010+전화번호 8자리
  name            TEXT NOT NULL,
  role            TEXT NOT NULL,            -- 'student' | 'manager' | 'admin'
  school          TEXT,
  grade           TEXT,                     -- '중1' | '중2' | '중3'
  class_name      TEXT,                     -- '중1' | '중2S' | '중2A' | '중3'
  parent_password TEXT,                     -- 학부모 전화번호 010+8자리
  self_index      INTEGER DEFAULT 70,
  risk_level      TEXT DEFAULT 'normal',    -- 'normal' | 'warning' | 'danger'
  status          TEXT DEFAULT 'active',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 기존 테이블에 컬럼 추가 (이미 생성된 경우)
ALTER TABLE users ADD COLUMN IF NOT EXISTS class_name      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_password TEXT;

-- ----------------------------------------------------------------
-- 2. 매니저-학생 배정
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignments (
  id           BIGSERIAL PRIMARY KEY,
  student_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  educator_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, educator_id)
);

-- ----------------------------------------------------------------
-- 3. 마인드 기록
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mind_records (
  id           TEXT PRIMARY KEY,
  student_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  mood         INTEGER NOT NULL CHECK (mood BETWEEN -5 AND 5),
  motivation   INTEGER NOT NULL CHECK (motivation BETWEEN -5 AND 5),
  confidence   INTEGER NOT NULL CHECK (confidence BETWEEN -5 AND 5),
  memo         TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 4. 3줄 일기 (하루 1개 제약)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diary_records (
  id           TEXT PRIMARY KEY,
  student_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  praise       TEXT DEFAULT '',
  reflection   TEXT DEFAULT '',
  resolution   TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date)
);

-- ----------------------------------------------------------------
-- 5. 학습 기록
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS learning_records (
  id           TEXT PRIMARY KEY,
  student_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  subject      TEXT NOT NULL,
  duration     INTEGER NOT NULL CHECK (duration > 0),  -- 분 단위
  focus        INTEGER NOT NULL CHECK (focus BETWEEN 0 AND 100),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 6. 출석 기록
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_records (
  id           TEXT PRIMARY KEY,
  student_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  status       TEXT NOT NULL DEFAULT 'present',  -- 'present' | 'late' | 'absent'
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 7. 과제
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id            TEXT PRIMARY KEY,
  student_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  subject       TEXT NOT NULL,
  due_date      DATE NOT NULL,
  due_time      TEXT DEFAULT '23:59',
  status        TEXT DEFAULT 'pending',  -- 'pending' | 'done'
  assigner_name TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 8. 상담/코칭 기록
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS counseling_records (
  id           TEXT PRIMARY KEY,
  student_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manager_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  content      TEXT NOT NULL,
  type         TEXT DEFAULT 'study',  -- 'mind' | 'career' | 'study'
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 9. 알림 (마인드 점수 낮을 때 자동 생성)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
  id               TEXT PRIMARY KEY,
  student_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manager_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type             TEXT DEFAULT 'mind',
  severity         TEXT DEFAULT 'warning',  -- 'warning' | 'danger'
  message          TEXT NOT NULL,
  detail           TEXT DEFAULT '',
  date             DATE NOT NULL,
  resolved         BOOLEAN DEFAULT FALSE,
  coaching_comment TEXT DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 10. TODO 아이템 (학습 계획)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS todo_items (
  id          TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  subject     TEXT NOT NULL,
  planned_min INTEGER NOT NULL CHECK (planned_min > 0),
  done        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 11. 진로 검사 결과
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS career_results (
  id                  TEXT PRIMARY KEY,
  student_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date                DATE NOT NULL,
  selected_verbs      JSONB,
  selected_activities JSONB,
  selected_categories JSONB,
  primary_cat         TEXT,
  type_name           TEXT,
  final_scores        JSONB,
  fields              JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 12. 학습 진단 결과
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diagnosis_results (
  id            TEXT PRIMARY KEY,
  student_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  answers       JSONB,
  domain_scores JSONB,
  stage_scores  JSONB,
  stage_grades  JSONB,
  state_types   JSONB,
  type_name     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 13. 월간 통계 (관리자 화면용)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monthly_stats (
  id           BIGSERIAL PRIMARY KEY,
  month        TEXT NOT NULL,
  self_index   INTEGER,
  task_rate    INTEGER,
  mind_total   INTEGER,
  center_hours INTEGER,
  year         INTEGER DEFAULT 2026
);

-- ================================================================
-- RLS 설정 (베타 기간: anon key로 전체 허용)
-- 실서비스 전환 시 student_id = auth.uid() 기반으로 강화 필요
-- 재실행 안전: DROP IF EXISTS 후 재생성
-- ================================================================
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE mind_records        ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE counseling_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_results      ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnosis_results   ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_stats       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all" ON users;
DROP POLICY IF EXISTS "anon_all" ON assignments;
DROP POLICY IF EXISTS "anon_all" ON mind_records;
DROP POLICY IF EXISTS "anon_all" ON diary_records;
DROP POLICY IF EXISTS "anon_all" ON learning_records;
DROP POLICY IF EXISTS "anon_all" ON attendance_records;
DROP POLICY IF EXISTS "anon_all" ON tasks;
DROP POLICY IF EXISTS "anon_all" ON counseling_records;
DROP POLICY IF EXISTS "anon_all" ON alerts;
DROP POLICY IF EXISTS "anon_all" ON todo_items;
DROP POLICY IF EXISTS "anon_all" ON career_results;
DROP POLICY IF EXISTS "anon_all" ON diagnosis_results;
DROP POLICY IF EXISTS "anon_all" ON monthly_stats;

CREATE POLICY "anon_all" ON users               FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON assignments         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON mind_records        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON diary_records       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON learning_records    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON attendance_records  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON tasks               FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON counseling_records  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON alerts              FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON todo_items          FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON career_results      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON diagnosis_results   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON monthly_stats       FOR ALL TO anon USING (true) WITH CHECK (true);
