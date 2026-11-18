-- ============================================================
-- 나비 후기 마이그레이션 (2026-11 클라이언트 요청)
-- 배경: 학생·학부모·강사(교과강사·컨설턴트) 홈에 '나비 후기 남기기' 코너 운영.
--       계정당 후기 1건(제출 후 수정 가능, 실명 저장 — 관리자가 열람).
--       강사별 후기는 instructor_reviews jsonb
--       [{ educatorId, educatorName, content }]로 보관 (강사 퇴직·개명에도 당시 이름 유지).
-- 사용: Supabase Studio → SQL Editor → RUN (코드 배포 전에 먼저 실행)
--       미적용 상태에서도 앱은 죽지 않는다 — 배너는 보이고 저장 시 오류만 표시.
-- 재실행 안전: IF NOT EXISTS / drop policy 후 재생성
-- ============================================================

CREATE TABLE IF NOT EXISTS navi_reviews (
  id                 TEXT PRIMARY KEY,         -- 앱 makeId('nrv') 생성 TEXT (프로젝트 관례)
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_role        TEXT NOT NULL,            -- student | parent | instructor | consultant (작성 시점 스냅샷)
  author_name        TEXT NOT NULL DEFAULT '',
  instructor_reviews JSONB NOT NULL DEFAULT '[]',
  to_director        TEXT NOT NULL DEFAULT '', -- 센터장에게 하고 싶은 말
  to_self            TEXT NOT NULL DEFAULT '', -- 나비 센터에 참여한 자신에게 하고 싶은 말
  most_helpful       TEXT NOT NULL DEFAULT '', -- 가장 도움이 되었던 점
  most_regret        TEXT NOT NULL DEFAULT '', -- 가장 아쉬운 점
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 계정당 1건 — 중복 제출 방지 (앱은 이미 있으면 수정으로 처리)
CREATE UNIQUE INDEX IF NOT EXISTS uq_navi_reviews_user
  ON navi_reviews (user_id);

-- RLS (기존 anon_all 체계와 동일 — lib/README.md 보안 부채 항목과 함께 재검토)
ALTER TABLE navi_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_navi_reviews" ON navi_reviews;
CREATE POLICY "anon_all_navi_reviews" ON navi_reviews
  FOR ALL TO anon USING (true) WITH CHECK (true);
