-- 041: 新增「推广复用价值等级」字段
-- 对应飞书多维表格字段「推广复用价值等级」（单选，如 "高价值" / "中价值" / "低价值"）
-- 040 已加 reuse_value（推广复用价值系数），本 migration 补等级字段
ALTER TABLE competition_submissions
  ADD COLUMN IF NOT EXISTS reuse_value_level TEXT;
