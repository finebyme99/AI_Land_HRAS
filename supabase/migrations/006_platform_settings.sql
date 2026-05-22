-- 平台设置表（首页数据大屏）
CREATE TABLE IF NOT EXISTS platform_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  saved_hours NUMERIC DEFAULT 0,
  participant_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- 插入默认记录
INSERT INTO platform_settings (id, saved_hours, participant_count)
VALUES (1, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings are viewable by everyone" ON platform_settings FOR SELECT USING (true);
