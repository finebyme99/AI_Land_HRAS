-- 为 platform_settings 表添加大赛获奖人数字段
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS award_count INTEGER DEFAULT 0;
