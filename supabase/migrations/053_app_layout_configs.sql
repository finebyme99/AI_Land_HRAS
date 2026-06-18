-- 053: 应用级布局配置表（admin 可视化配置，全局生效）
--
-- 设计要点：
--   - scope 维度：目前只用 'global'，未来可扩展到 'user' / 'role'
--   - key 维度：每个 key 对应一个可配置布局（如 'competitions-entry-card'）
--   - config 存 JSONB：自由结构（group / fields / hidden / 未来 width / format）
--   - 单行（global + key）唯一约束，PUT 时 upsert
--
-- 数据形态（competitions-entry-card）：
--   {
--     "groups": [
--       { "id": "g1", "title": "参赛信息", "color": "#1a3a8a", "fields": ["team", "teamType", ...] },
--       { "id": "g2", "title": "价值指标", "color": "#F27F22", "fields": ["monthlySavedHours", ...] }
--     ],
--     "hiddenFields": ["briefIntro"]
--   }

CREATE TABLE IF NOT EXISTS app_layout_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 定位
  scope text NOT NULL DEFAULT 'global',   -- 未来可扩 user / role
  key text NOT NULL,                       -- 如 'competitions-entry-card'

  -- 配置内容（JSONB，自由结构）
  config jsonb NOT NULL,

  -- 审计
  updated_by text,                          -- user id（飞书 user_id），可空
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT app_layout_configs_scope_key_unique UNIQUE (scope, key)
);

-- updated_at 触发器
CREATE OR REPLACE FUNCTION app_layout_configs_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_layout_configs_updated_at ON app_layout_configs;
CREATE TRIGGER trg_app_layout_configs_updated_at
  BEFORE UPDATE ON app_layout_configs
  FOR EACH ROW EXECUTE FUNCTION app_layout_configs_set_updated_at();

-- RLS：所有登录用户可读（卡片渲染用），admin/moderator 可写
ALTER TABLE app_layout_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_layout_configs read all" ON app_layout_configs;
CREATE POLICY "app_layout_configs read all" ON app_layout_configs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "app_layout_configs admin write" ON app_layout_configs;
CREATE POLICY "app_layout_configs admin write" ON app_layout_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND (users.roles @> ARRAY['admin']::text[] OR users.roles @> ARRAY['moderator']::text[])
    )
  );

COMMENT ON TABLE app_layout_configs IS
  '应用级布局配置（admin 可视化配置、全局生效）。scope=global 时单行；key 标识具体布局（如 competitions-entry-card）。';
COMMENT ON COLUMN app_layout_configs.config IS
  '自由 JSONB 结构，key 不同 schema 不同。如 competitions-entry-card 用 groups[] + hiddenFields[]。';
