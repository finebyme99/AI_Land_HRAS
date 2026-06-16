-- 飞书公式字段直同步（替代客户端计算）
ALTER TABLE competition_submissions
  ADD COLUMN IF NOT EXISTS monthly_cost_saving_hours NUMERIC,        -- 月均降本折算工时
  ADD COLUMN IF NOT EXISTS total_monthly_saved_hours NUMERIC,        -- 月均节省总工时
  ADD COLUMN IF NOT EXISTS scene_region_coefficient_value NUMERIC,   -- 场景归属地区系数值
  ADD COLUMN IF NOT EXISTS reuse_value_coefficient NUMERIC;          -- 推广复用价值系数值
