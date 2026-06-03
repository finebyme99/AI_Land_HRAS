-- 更新 apps 表的 category 约束：AI工具/Skills → AI Agent/大模型/好用 Skills
ALTER TABLE apps DROP CONSTRAINT IF EXISTS apps_category_check;
UPDATE apps SET category = 'AI Agent/大模型' WHERE category = 'AI工具';
UPDATE apps SET category = '好用 Skills' WHERE category = 'Skills';
ALTER TABLE apps ADD CONSTRAINT apps_category_check CHECK (category IN ('AI Agent/大模型', '好用 Skills'));
