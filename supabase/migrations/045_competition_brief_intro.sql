-- 成效看板：添加"一句话简介"字段（从飞书多维表格同步）
ALTER TABLE competition_submissions ADD COLUMN IF NOT EXISTS brief_intro TEXT;
