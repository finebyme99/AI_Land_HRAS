-- 场景归属地区系数值（飞书公式字段）
ALTER TABLE competition_submissions
  ADD COLUMN IF NOT EXISTS scene_region_coefficient_value NUMERIC;
