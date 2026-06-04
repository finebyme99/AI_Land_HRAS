-- 新增课程期数字段
ALTER TABLE courses ADD COLUMN IF NOT EXISTS period TEXT;
