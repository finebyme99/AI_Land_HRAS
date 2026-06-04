-- 新增飞书图片key字段（用于卡片海报）
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cover_image_key TEXT;
