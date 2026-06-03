-- 新增 Demo链接 字段
ALTER TABLE competition_submissions
ADD COLUMN IF NOT EXISTS demo_link TEXT;
