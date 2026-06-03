-- 推送日志表
CREATE TABLE push_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  content_title TEXT,
  target_chat_id TEXT NOT NULL,
  target_chat_name TEXT,
  card_json JSONB,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  pushed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_push_logs_created ON push_logs(created_at DESC);

-- RLS: 仅管理员可读写
ALTER TABLE push_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read push_logs" ON push_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
  );

CREATE POLICY "Admins can insert push_logs" ON push_logs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
  );
