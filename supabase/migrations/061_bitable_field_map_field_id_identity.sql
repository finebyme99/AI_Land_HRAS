-- 061: 用飞书 field_id 作为字段映射的稳定身份
-- 目标：飞书字段改名时，只刷新 bitable_field_map.field_name，不再插入 unknown 新行或让旧行 orphan。

-- 历史上可能已经因为字段改名插入过重复 field_id 的映射。
-- 保留更可信的一行：优先非 unknown key，其次启用行，再按更新时间。
-- 其余重复行停用、清空 field_id，并给 field_name 加后缀避让唯一字段名约束。
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY base_app, table_id, field_id
      ORDER BY
        CASE WHEN key LIKE 'unknown_%' THEN 1 ELSE 0 END ASC,
        is_active DESC,
        updated_at DESC,
        created_at DESC,
        id DESC
    ) AS rn
  FROM bitable_field_map
  WHERE field_id IS NOT NULL AND field_id <> ''
)
UPDATE bitable_field_map b
SET
  field_id = NULL,
  is_active = false,
  field_name = b.field_name || ' (duplicate ' || left(b.id::text, 8) || ')',
  updated_at = now()
FROM ranked r
WHERE b.id = r.id
  AND r.rn > 1;

-- 同一张飞书表内，非空 field_id 只能对应一条映射。
CREATE UNIQUE INDEX IF NOT EXISTS idx_bitable_field_map_field_id_unique
  ON bitable_field_map (base_app, table_id, field_id)
  WHERE field_id IS NOT NULL AND field_id <> '';

COMMENT ON INDEX idx_bitable_field_map_field_id_unique IS
  '保证同一飞书表内 field_id 是稳定唯一身份；字段改名应更新 field_name，而不是新增映射行。';
