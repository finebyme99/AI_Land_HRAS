-- 删除 source_url 字段（已被 demo_link 替代）
ALTER TABLE competition_submissions
DROP COLUMN IF EXISTS source_url;
