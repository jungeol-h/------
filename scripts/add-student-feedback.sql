-- ============================================================
-- 학생 피드백(수시 코멘트) 마이그레이션 (2026-08-09 클라이언트 요청)
-- 배경: "과제 내기 옆에 '피드백'을 넣어서 수시로 기록 내용에 대한
--       코멘트를 달 수 있도록" — 상담 기록(counseling_records)과 별개로
--       가벼운 수시 코멘트를 남기는 저장소. 종합성장리포트의
--       '피드백 내용' 섹션이 이 테이블을 소비한다.
-- 주의: 기존 `feedback` 테이블은 앱 버그리포트/건의함이라 이름 충돌 —
--       student_feedbacks로 분리.
-- 사용: Supabase Studio → SQL Editor → RUN (코드 배포 전에 먼저 실행)
-- 재실행 안전: IF NOT EXISTS / drop policy 후 재생성
-- ============================================================

CREATE TABLE IF NOT EXISTS student_feedbacks (
  id          TEXT PRIMARY KEY,         -- 앱 makeId('sfb') 생성 TEXT (프로젝트 관례)
  student_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id   TEXT,                     -- 작성자 users.id (표시는 이름 스냅샷 사용)
  author_name TEXT NOT NULL DEFAULT '',
  date        DATE NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_feedbacks_student
  ON student_feedbacks (student_id, date DESC);

-- RLS (기존 anon_all 체계와 동일 — lib/README.md 보안 부채 항목과 함께 재검토)
ALTER TABLE student_feedbacks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_student_feedbacks" ON student_feedbacks;
CREATE POLICY "anon_all_student_feedbacks" ON student_feedbacks
  FOR ALL TO anon USING (true) WITH CHECK (true);
