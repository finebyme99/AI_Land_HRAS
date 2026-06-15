-- 046: 同步飞书公式字段（频次、月均耗时）
--   Feishu formula fields synced directly instead of client-side calculation

ALTER TABLE competition_submissions
  ADD COLUMN IF NOT EXISTS before_freq NUMERIC,
  ADD COLUMN IF NOT EXISTS after_freq NUMERIC,
  ADD COLUMN IF NOT EXISTS before_monthly_hours NUMERIC;
