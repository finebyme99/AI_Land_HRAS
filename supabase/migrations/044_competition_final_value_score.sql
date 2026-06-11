-- 044: 新增 最终价值计分 列
-- 飞书字段 "最终价值计分" → final_value_score
-- 公式：(月均提效节省工时 + 月均降本节省工时) × 人力成本系数值 × 推广复用价值系数值

ALTER TABLE competition_submissions
  ADD COLUMN IF NOT EXISTS final_value_score NUMERIC;
