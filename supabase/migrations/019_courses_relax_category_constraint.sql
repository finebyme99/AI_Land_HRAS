-- courses 表 category 字段：移除 CHECK 约束，允许任意文本（支持 JSON 数组）
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_category_check;

-- content_type 同理
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_content_type_check;
