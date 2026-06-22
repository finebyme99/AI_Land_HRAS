-- 工具推荐：适用部门，多选，选项来自大赛「提报团队」
ALTER TABLE apps
  ADD COLUMN IF NOT EXISTS applicable_departments text[] NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
