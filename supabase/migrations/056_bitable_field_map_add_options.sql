-- bitable_field_map 新增 options 列，存储飞书 select/multi_select 字段的选项列表
-- 用途：前端筛选下拉框直接从字段定义读枚举，不再依赖数据子集聚合
-- 同步来源：sync-from-feishu 从飞书 fields API 的 property.options 抓取
-- 格式：[{id: "optXXX", name: "数据分析"}, ...]
ALTER TABLE bitable_field_map ADD COLUMN IF NOT EXISTS options JSONB;
COMMENT ON COLUMN bitable_field_map.options IS
  'select/multi_select 字段的选项列表，格式: [{id, name, color}]。非 select 字段此列为 null。';
