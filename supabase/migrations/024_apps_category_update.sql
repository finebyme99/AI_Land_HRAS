-- 更新 apps 表的 category 约束：旧分类 → 新分类（AI工具、Skills）
-- 先更新现有数据
UPDATE apps SET category = 'AI工具' WHERE category IN ('对话类', '写作类', '设计类', '数据分析', '自动化', 'HR专属');

-- 删除旧约束
ALTER TABLE apps DROP CONSTRAINT IF EXISTS apps_category_check;

-- 添加新约束
ALTER TABLE apps ADD CONSTRAINT apps_category_check CHECK (category IN ('AI工具', 'Skills'));
