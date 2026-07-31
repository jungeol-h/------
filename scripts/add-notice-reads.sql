-- ============================================================
-- 공지 읽음 기록 마이그레이션 (2026-07-31 — add-notices 후속)
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN
-- ------------------------------------------------------------
-- notice_reads — 공지 팝업 '확인' 기록을 사용자 단위로 저장.
-- localStorage 기록은 기기(브라우저)마다 따로라 다기기 사용자가 기기마다
-- 팝업을 다시 보는 문제가 있어 서버 기록으로 전환한다. 클라는 이 테이블을
-- 우선 판정하고, 조회·쓰기 실패 시 localStorage 판정으로 자연 강등된다
-- (테이블 미적용 상태로 코드가 먼저 배포돼도 종전 동작 유지).
-- 공지 삭제 시 읽음 기록도 함께 삭제(FK CASCADE).
-- ------------------------------------------------------------
-- 재실행 안전: IF NOT EXISTS / drop policy 후 재생성.
-- ============================================================

CREATE TABLE IF NOT EXISTS notice_reads (
  notice_id TEXT NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL,
  read_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (notice_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notice_reads_user ON notice_reads (user_id);

ALTER TABLE notice_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_notice_reads" ON notice_reads;
CREATE POLICY "anon_all_notice_reads" ON notice_reads
  FOR ALL TO anon USING (true) WITH CHECK (true);
