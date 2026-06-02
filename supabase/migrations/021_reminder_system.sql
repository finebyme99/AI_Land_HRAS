-- 021_reminder_system.sql
-- 飞书提醒系统数据库表结构

-- 消息模板表
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'card', -- text/card
  title_template TEXT,
  content_template TEXT NOT NULL,
  card_template JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 提醒规则配置表
CREATE TABLE IF NOT EXISTS reminder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL, -- review_progress/deadline/new_content/custom
  trigger_event VARCHAR(100), -- review_completed/deadline_approaching/new_submission
  priority VARCHAR(20) DEFAULT 'medium', -- high/medium/low
  template_id UUID REFERENCES message_templates(id),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 提醒接收人配置表
CREATE TABLE IF NOT EXISTS reminder_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES reminder_rules(id) ON DELETE CASCADE,
  recipient_type VARCHAR(50) NOT NULL, -- role/user/group
  recipient_id VARCHAR(100) NOT NULL, -- 角色名/用户ID/群聊ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 提醒发送记录表
CREATE TABLE IF NOT EXISTS reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES reminder_rules(id),
  recipient_id VARCHAR(100) NOT NULL,
  recipient_type VARCHAR(50) NOT NULL,
  message_id VARCHAR(100), -- 飞书消息ID
  status VARCHAR(20) DEFAULT 'pending', -- pending/sent/failed/read
  priority VARCHAR(20),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 定时任务调度表
CREATE TABLE IF NOT EXISTS scheduled_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES reminder_rules(id),
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending/executing/completed/failed
  executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_reminder_rules_type ON reminder_rules(type);
CREATE INDEX IF NOT EXISTS idx_reminder_rules_active ON reminder_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_reminder_recipients_rule ON reminder_recipients(rule_id);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_rule ON reminder_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_status ON reminder_logs(status);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_created ON reminder_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_status ON scheduled_reminders(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_scheduled ON scheduled_reminders(scheduled_at);

-- RLS 策略
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reminders ENABLE ROW LEVEL SECURITY;

-- 管理员可以访问所有提醒相关表
CREATE POLICY "Admins can manage message_templates" ON message_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.roles ? 'admin')
  );

CREATE POLICY "Admins can manage reminder_rules" ON reminder_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.roles ? 'admin')
  );

CREATE POLICY "Admins can manage reminder_recipients" ON reminder_recipients
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.roles ? 'admin')
  );

CREATE POLICY "Admins can view reminder_logs" ON reminder_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.roles ? 'admin')
  );

CREATE POLICY "Admins can manage scheduled_reminders" ON scheduled_reminders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.roles ? 'admin')
  );

-- 插入默认消息模板
INSERT INTO message_templates (name, type, title_template, content_template, card_template) VALUES
(
  '评审进度提醒',
  'card',
  '📋 评审进度提醒',
  '您有 {{count}} 个待评审方案，请及时处理。',
  '{
    "config": {"wide_screen_mode": true},
    "header": {"title": {"tag": "plain_text", "content": "📋 评审进度提醒"}, "template": "blue"},
    "elements": [
      {"tag": "div", "text": {"tag": "lark_md", "content": "您有 **{{count}}** 个待评审方案，请及时处理。"}},
      {"tag": "hr"},
      {"tag": "action", "actions": [{"tag": "button", "text": {"tag": "plain_text", "content": "立即评审"}, "type": "primary", "url": "{{action_url}}"}]}
    ]
  }'
),
(
  '截止日期提醒',
  'card',
  '⏰ 评审截止日期提醒',
  '距离评审截止还有 {{days}} 天，请尽快完成评审。',
  '{
    "config": {"wide_screen_mode": true},
    "header": {"title": {"tag": "plain_text", "content": "⏰ 评审截止日期提醒"}, "template": "orange"},
    "elements": [
      {"tag": "div", "text": {"tag": "lark_md", "content": "⏰ **评审截止日期提醒**\n\n距离评审截止还有 **{{days}}** 天\n截止时间: {{deadline}}"}},
      {"tag": "hr"},
      {"tag": "div", "text": {"tag": "lark_md", "content": "📊 当前待评审方案: **{{count}}** 个"}},
      {"tag": "action", "actions": [{"tag": "button", "text": {"tag": "plain_text", "content": "立即评审"}, "type": "primary", "url": "{{action_url}}"}]}
    ]
  }'
),
(
  '新方案提醒',
  'card',
  '🆕 新方案提交提醒',
  '有新方案提交，请及时评审。',
  '{
    "config": {"wide_screen_mode": true},
    "header": {"title": {"tag": "plain_text", "content": "🆕 新方案提交提醒"}, "template": "green"},
    "elements": [
      {"tag": "div", "text": {"tag": "lark_md", "content": "🆕 **新方案提交提醒**\n\n**方案名称**: {{title}}\n**提交人**: {{submitter}}"}},
      {"tag": "hr"},
      {"tag": "action", "actions": [{"tag": "button", "text": {"tag": "plain_text", "content": "查看详情"}, "type": "primary", "url": "{{action_url}}"}]}
    ]
  }'
),
(
  '评审完成通知',
  'card',
  '✅ 评审完成通知',
  '您的方案已完成评审。',
  '{
    "config": {"wide_screen_mode": true},
    "header": {"title": {"tag": "plain_text", "content": "✅ 评审完成通知"}, "template": "green"},
    "elements": [
      {"tag": "div", "text": {"tag": "lark_md", "content": "✅ **评审完成通知**\n\n**方案名称**: {{title}}\n**评审结果**: {{result}}\n**总分**: {{score}}"}},
      {"tag": "hr"},
      {"tag": "action", "actions": [{"tag": "button", "text": {"tag": "plain_text", "content": "查看详情"}, "type": "primary", "url": "{{action_url}}"}]}
    ]
  }'
);
