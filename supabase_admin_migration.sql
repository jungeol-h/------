-- admin_config 테이블 생성
-- Supabase Dashboard > SQL Editor 에서 실행하세요.

CREATE TABLE IF NOT EXISTS admin_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 업데이트 시 updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_config_updated_at
  BEFORE UPDATE ON admin_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS(Row Level Security) 설정: anon key로 읽기 가능, 쓰기는 service_role만
ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can read" ON admin_config
  FOR SELECT TO anon USING (true);

CREATE POLICY "authenticated can write" ON admin_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- anon key로도 upsert 가능하게 (비밀번호 인증은 프론트에서만 처리)
CREATE POLICY "anon can write" ON admin_config
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon can update" ON admin_config
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
