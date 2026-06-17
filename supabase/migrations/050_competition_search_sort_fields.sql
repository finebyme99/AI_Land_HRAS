-- 搜索/排序条件所需字段
ALTER TABLE competition_submissions
  ADD COLUMN IF NOT EXISTS scene_source TEXT,
  ADD COLUMN IF NOT EXISTS landing_progress TEXT,
  ADD COLUMN IF NOT EXISTS competition_progress TEXT;
