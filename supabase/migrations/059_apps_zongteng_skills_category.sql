-- 扩展工具推荐分类：新增「纵腾人专属 Skills」
ALTER TABLE apps DROP CONSTRAINT IF EXISTS apps_category_check;

ALTER TABLE apps ADD CONSTRAINT apps_category_check CHECK (
  category IN ('AI Agent/大模型', '好用 Skills', '纵腾人专属 Skills')
);
