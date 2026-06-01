-- 资源推荐模块扩展：apps 表增加 resource_type、content、author_id 列
-- 已有数据默认 resource_type = 'ai_tool'

ALTER TABLE apps
  ADD COLUMN IF NOT EXISTS resource_type text NOT NULL DEFAULT 'ai_tool',
  ADD COLUMN IF NOT EXISTS content text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES auth.users(id);

-- 索引：按资源类型 + 状态查询
CREATE INDEX IF NOT EXISTS idx_apps_resource_type_status ON apps(resource_type, status);
