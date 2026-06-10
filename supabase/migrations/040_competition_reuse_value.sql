-- 040: 新增「推广复用价值系数」字段
-- 对应飞书多维表格单选字段「推广复用价值系数」，选项格式如 "高价值 x3"
ALTER TABLE competition_submissions
  ADD COLUMN IF NOT EXISTS reuse_value TEXT;
