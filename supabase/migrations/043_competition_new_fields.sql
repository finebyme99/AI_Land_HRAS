-- 043: 新表 tbl9WJyxl9bbtYjb 适配字段
--   - monthly_saved_cost: 月均降本费用（不含人力成本）
--   - cost_reduction_note: 降本费用说明
--   - implementation_link: 实现效果链接（飞书"实现效果"字段，link 类型）

ALTER TABLE competition_submissions
  ADD COLUMN IF NOT EXISTS monthly_saved_cost TEXT,
  ADD COLUMN IF NOT EXISTS cost_reduction_note TEXT,
  ADD COLUMN IF NOT EXISTS implementation_link TEXT;
