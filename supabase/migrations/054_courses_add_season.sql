-- 新增课程季数字段（用于 AI 公开课按季分组）
-- 对应飞书多维表格的【季数】字段，如"第一季"/"第二季"
-- sync 路由已写入该字段，此前因列不存在导致 season 全为 null，页面全部归入"未分类"
ALTER TABLE courses ADD COLUMN IF NOT EXISTS season TEXT;
