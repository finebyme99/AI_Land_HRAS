-- bitable_field_map 新增 description 列，存储飞书多维表格的字段注释
-- 用途：前端表格表头问号 tooltip 动态展示飞书字段说明（如提效工时/降本费用/最终价值计分的口径）
-- 同步来源：sync-from-feishu 从飞书 fields API 的 description 字段抓取
ALTER TABLE bitable_field_map ADD COLUMN IF NOT EXISTS description TEXT;
