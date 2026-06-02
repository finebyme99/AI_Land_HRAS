-- 023_reminder_add_send_date.sql
-- 给 reminders 表添加 send_date 字段（once 类型用）
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS send_date DATE;
