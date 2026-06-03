-- 新增量化数据来源字段
ALTER TABLE competition_submissions
ADD COLUMN IF NOT EXISTS data_source TEXT,
ADD COLUMN IF NOT EXISTS data_source_note TEXT;
