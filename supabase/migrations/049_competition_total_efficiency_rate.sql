-- 总降本提效比例（飞书公式字段）+ 场景归属地区系数（文本）
ALTER TABLE competition_submissions
  ADD COLUMN IF NOT EXISTS total_efficiency_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS region_coefficient TEXT;
