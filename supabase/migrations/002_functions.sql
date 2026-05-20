-- ============================================
-- 数据库函数
-- ============================================

-- 增加浏览量
CREATE OR REPLACE FUNCTION increment_view_count(table_name TEXT, row_id UUID)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('UPDATE %I SET view_count = view_count + 1 WHERE id = %L', table_name, row_id);
END;
$$ LANGUAGE plpgsql;

-- 增加计数字段
CREATE OR REPLACE FUNCTION increment_count(table_name TEXT, row_id UUID, column_name TEXT, increment_by INTEGER DEFAULT 1)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('UPDATE %I SET %I = %I + %L WHERE id = %L', table_name, column_name, column_name, increment_by, row_id);
END;
$$ LANGUAGE plpgsql;
