-- 024_reminders_recipient_and_card.sql
-- Reminder 系统扩展 + 课程同步时间戳

-- 1. reminders 加 card_template（飞书卡片 JSONB）
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS card_template JSONB;

-- 2. reminder_targets 扩列
ALTER TABLE reminder_targets ADD COLUMN IF NOT EXISTS recipient_type TEXT NOT NULL DEFAULT 'user';
ALTER TABLE reminder_targets ADD COLUMN IF NOT EXISTS recipient_id TEXT;

-- 3. 回填 user 类型行的 recipient_id
UPDATE reminder_targets SET recipient_id = user_id::text WHERE recipient_id IS NULL;

-- 4. platform_settings 加课程同步时间戳（单行表，新加列无侵入）
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS courses_last_synced_at TIMESTAMPTZ;
