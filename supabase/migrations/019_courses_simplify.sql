-- courses 表简化：去掉 category CHECK 约束，更新 difficulty CHECK 约束
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_category_check;
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_content_type_check;
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_difficulty_check;

-- 更新难度约束为新值
ALTER TABLE courses ADD CONSTRAINT courses_difficulty_check CHECK (difficulty IN ('初阶', '进阶', '高阶'));
