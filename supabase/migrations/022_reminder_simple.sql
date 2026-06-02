-- 022_reminder_simple.sql
-- 提醒模块重构 — 精简版：标题 + 频次 + 时间 + 对象

-- 1. 提醒主表
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT 'once',       -- once / daily / weekly
  send_time TIME NOT NULL DEFAULT '09:00',      -- 每天发送时间
  send_day INT,                                  -- weekly 时: 1=周一 ... 7=周日
  next_send_at TIMESTAMPTZ,                      -- 下次发送时间（cron 扫描用）
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 提醒对象（关联用户）
CREATE TABLE IF NOT EXISTS reminder_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID REFERENCES reminders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reminder_id, user_id)
);

-- 3. 发送日志
CREATE TABLE IF NOT EXISTS reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID REFERENCES reminders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  feishu_open_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent',           -- sent / skipped / failed
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_reminders_next_send ON reminders(next_send_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_reminder_targets_reminder ON reminder_targets(reminder_id);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_reminder ON reminder_logs(reminder_id);

-- RLS
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reminders" ON reminders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND 'admin' = ANY(users.roles))
  );

CREATE POLICY "Admins can manage reminder_targets" ON reminder_targets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND 'admin' = ANY(users.roles))
  );

CREATE POLICY "Admins can view reminder_logs" ON reminder_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND 'admin' = ANY(users.roles))
  );
