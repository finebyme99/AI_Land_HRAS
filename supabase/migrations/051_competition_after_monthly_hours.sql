-- 新月均耗时（飞书公式字段）
ALTER TABLE competition_submissions
  ADD COLUMN IF NOT EXISTS after_monthly_hours NUMERIC;
