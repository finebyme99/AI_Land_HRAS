-- courses 表简化：
-- 1. category 改为可空（表单已移除该字段）
-- 2. 移除 category/content_type CHECK 约束
-- 3. content_type 从 TEXT 改为 JSONB（支持多选数组 + .contains() 查询）
-- 4. 更新 difficulty CHECK 约束为新值
-- 5. 添加 courseware_url、video_url 列

-- 1. category 可空
ALTER TABLE courses ALTER COLUMN category DROP NOT NULL;

-- 2. 移除旧 CHECK 约束
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_category_check;
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_content_type_check;
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_difficulty_check;

-- 3. content_type 改为 JSONB（先迁移旧数据）
UPDATE courses SET content_type = '["' || content_type || '"]'
  WHERE content_type IS NOT NULL AND content_type NOT LIKE '[%';
ALTER TABLE courses ALTER COLUMN content_type SET DATA TYPE jsonb USING content_type::jsonb;

-- 4. 新 difficulty 约束
ALTER TABLE courses ADD CONSTRAINT courses_difficulty_check CHECK (difficulty IN ('初阶', '进阶', '高阶'));

-- 5. 新增列
ALTER TABLE courses ADD COLUMN IF NOT EXISTS courseware_url TEXT DEFAULT '';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT '';
