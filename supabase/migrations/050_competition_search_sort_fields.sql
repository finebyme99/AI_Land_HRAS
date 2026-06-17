-- 搜索/排序条件所需字段
-- 注意：大赛进展使用已有的 status 字段，不需要 competition_progress
ALTER TABLE competition_submissions
  ADD COLUMN IF NOT EXISTS scene_source TEXT,
  ADD COLUMN IF NOT EXISTS landing_progress TEXT;
