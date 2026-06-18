-- 052: 飞书多维表格字段映射配置表
--   解决痛点：FIELD_MAP 三处硬编码，新增字段需改三处；字段名称一改数据就断
--   admin UI 在 /admin/bitable-field-map 维护这张表，三个消费 API（sync / progress / wish-pool）
--   启动时优先读 DB，读不到 fallback 到 lib/bitable/field-map.ts 的硬编码

CREATE TABLE IF NOT EXISTS bitable_field_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 定位飞书表
  base_app text NOT NULL,
  table_id text NOT NULL,

  -- 飞书字段元信息（field_id 是稳定锚点，字段改名不会变）
  field_id text,             -- nullable：从硬编码 seed 时可能没有 field_id
  field_name text NOT NULL,  -- 飞书原始字段名（中文）

  -- 前端 / 业务命名
  key text NOT NULL,                  -- 前端 camelCase key
  type text NOT NULL,                 -- text / number / select / multi_select / person / formula / date / url
  group_name text NOT NULL DEFAULT '未分组',

  -- 控制
  is_active boolean NOT NULL DEFAULT true,         -- false = 此字段不被消费（飞书有但代码不要）
  roles text[] NOT NULL DEFAULT '{sync,progress,wish-pool}',

  -- 展示
  sort_order integer NOT NULL DEFAULT 0,

  -- 时间戳
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- 同一张飞书表内字段名不能重
  CONSTRAINT bitable_field_map_table_name_unique UNIQUE (base_app, table_id, field_name)
);

-- 索引：按飞书表快速查
CREATE INDEX IF NOT EXISTS idx_bitable_field_map_table
  ON bitable_field_map (base_app, table_id);

-- 索引：按 key 反查
CREATE INDEX IF NOT EXISTS idx_bitable_field_map_key
  ON bitable_field_map (base_app, table_id, key);

-- updated_at 自动维护
CREATE OR REPLACE FUNCTION bitable_field_map_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bitable_field_map_updated_at ON bitable_field_map;
CREATE TRIGGER trg_bitable_field_map_updated_at
  BEFORE UPDATE ON bitable_field_map
  FOR EACH ROW EXECUTE FUNCTION bitable_field_map_set_updated_at();

-- RLS：admin 才能写，所有登录用户能读（sync/progress/wish-pool 都需要读）
ALTER TABLE bitable_field_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bitable_field_map read all" ON bitable_field_map;
CREATE POLICY "bitable_field_map read all" ON bitable_field_map
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "bitable_field_map admin write" ON bitable_field_map;
CREATE POLICY "bitable_field_map admin write" ON bitable_field_map
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND (users.roles @> ARRAY['admin']::text[] OR users.roles @> ARRAY['moderator']::text[])
    )
  );

COMMENT ON TABLE bitable_field_map IS
  '飞书多维表格字段映射配置。sync / progress / wish-pool 三个 API 优先读这张表，读不到 fallback 到 lib/bitable/field-map.ts 的硬编码。';
COMMENT ON COLUMN bitable_field_map.field_id IS
  '飞书字段 ID（稳定锚点）。字段改名不会影响 field_id，但记录中无 field_id 的行（如手动添加）依然可工作。';
COMMENT ON COLUMN bitable_field_map.roles IS
  '数组：sync / progress / wish-pool。空数组 = 都不消费。';