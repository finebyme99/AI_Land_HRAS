-- Production hotfix: align the apps table with the current resource submission flow.
-- This is intentionally self-contained because some production databases may have
-- skipped one or more earlier manual migrations for the resources module.

ALTER TABLE apps
  ADD COLUMN IF NOT EXISTS resource_type text NOT NULL DEFAULT 'ai_tool',
  ADD COLUMN IF NOT EXISTS content text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS applicable_departments text[] NOT NULL DEFAULT '{}';

ALTER TABLE apps
  ALTER COLUMN resource_type SET DEFAULT 'ai_tool',
  ALTER COLUMN content SET DEFAULT '',
  ALTER COLUMN is_featured SET DEFAULT false,
  ALTER COLUMN applicable_departments SET DEFAULT '{}';

UPDATE apps
SET
  resource_type = COALESCE(resource_type, 'ai_tool'),
  content = COALESCE(content, ''),
  is_featured = COALESCE(is_featured, false),
  applicable_departments = COALESCE(applicable_departments, '{}');

ALTER TABLE apps
  ALTER COLUMN resource_type SET NOT NULL,
  ALTER COLUMN content SET NOT NULL,
  ALTER COLUMN is_featured SET NOT NULL,
  ALTER COLUMN applicable_departments SET NOT NULL;

UPDATE apps SET category = 'AI Agent/大模型'
WHERE category IN ('AI工具', '对话类', '写作类', '设计类', '数据分析', '自动化', 'HR专属');

UPDATE apps SET category = '好用 Skills'
WHERE category = 'Skills';

ALTER TABLE apps DROP CONSTRAINT IF EXISTS apps_category_check;
ALTER TABLE apps ADD CONSTRAINT apps_category_check CHECK (
  category IN ('AI Agent/大模型', '好用 Skills', '纵腾人专属 Skills')
) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_apps_resource_type_status ON apps(resource_type, status);

COMMENT ON COLUMN apps.resource_type IS '资源类型，历史工具默认为 ai_tool';
COMMENT ON COLUMN apps.content IS '工具资源详情内容';
COMMENT ON COLUMN apps.is_featured IS '是否精选展示';
COMMENT ON COLUMN apps.applicable_departments IS '工具资源适用部门，多选，选项来自大赛提报团队';

NOTIFY pgrst, 'reload schema';
