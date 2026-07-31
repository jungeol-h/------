-- ============================================================
-- 공지·알림 마이그레이션 (2026-07-31 클라이언트 요청)
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN
-- ------------------------------------------------------------
-- notices — 관리자·강사가 작성하는 공지(로그인 팝업)와 알림(홈 알림 칸 누적).
--  - kind 'announcement' = 공지: 전 역할 홈에서 로그인 시 팝업 1회 노출
--    (노출 여부는 클라 localStorage `namac_notice_{id}_{userId}` — 서버 기록 없음).
--  - kind 'notification' = 알림: 학생·학부모 홈 '알림' 칸에 날짜+내용 누적 표시.
--  - audience: 알림의 대상. 공지는 'all' 고정 (폼에서 강제).
--  - active=false 는 내리기(소프트 삭제 아님 — 목록 관리용). 완전 삭제도 허용.
--  - id는 앱 makeId('ntc') 생성 TEXT (프로젝트 관례).
-- ------------------------------------------------------------
-- 재실행 안전: IF NOT EXISTS / drop policy 후 재생성.
-- ============================================================

-- ── 1) notices 테이블 ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS notices (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL DEFAULT 'notification'
                  CHECK (kind IN ('announcement', 'notification')),
  audience        TEXT NOT NULL DEFAULT 'all'
                  CHECK (audience IN ('all', 'student', 'parent')),
  title           TEXT NOT NULL DEFAULT '',
  content         TEXT NOT NULL,
  created_by      TEXT,            -- 작성자 users.id (표시는 이름 스냅샷 사용)
  created_by_name TEXT NOT NULL DEFAULT '',
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notices_active_created
  ON notices (active, created_at DESC);

-- ── 2) RLS (기존 anon_all 체계와 동일 — lib/README.md 보안 부채 항목과 함께 재검토) ──
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_notices" ON notices;
CREATE POLICY "anon_all_notices" ON notices
  FOR ALL TO anon USING (true) WITH CHECK (true);
