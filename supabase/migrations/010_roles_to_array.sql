-- 010_roles_to_array.sql
-- 将 users.role (TEXT) 改为 users.roles (TEXT[])，支持多角色

-- 1. 先删掉依赖 role 列的 RLS 策略
DROP POLICY IF EXISTS "Reviews readable by reviewers and admins" ON competition_reviews;
DROP POLICY IF EXISTS "Reviewers can insert own reviews" ON competition_reviews;
DROP POLICY IF EXISTS "Reviewers can update own reviews" ON competition_reviews;

-- 2. 新增 roles 数组列
ALTER TABLE users ADD COLUMN roles TEXT[] DEFAULT ARRAY['user'];

-- 3. 迁移已有数据：role TEXT → roles TEXT[]
UPDATE users SET roles = ARRAY[role];

-- 4. 删除旧列
ALTER TABLE users DROP COLUMN role;

-- 5. 重建 set_user_role 函数，改为 set_user_roles
CREATE OR REPLACE FUNCTION set_user_roles(p_feishu_open_id TEXT, p_roles TEXT[])
RETURNS VOID AS $$
BEGIN
  UPDATE users SET roles = p_roles, updated_at = NOW()
  WHERE feishu_open_id = p_feishu_open_id;
END;
$$ LANGUAGE plpgsql;

-- 6. 用新的 roles 数组列重建 RLS 策略
CREATE POLICY "Reviews readable by reviewers and admins" ON competition_reviews
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.roles && ARRAY['reviewer', 'admin', 'moderator'])
  );

CREATE POLICY "Reviewers can insert own reviews" ON competition_reviews
  FOR INSERT WITH CHECK (
    reviewer_id = auth.uid() AND
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.roles && ARRAY['reviewer', 'admin', 'moderator'])
  );

CREATE POLICY "Reviewers can update own reviews" ON competition_reviews
  FOR UPDATE USING (
    reviewer_id = auth.uid() AND
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.roles && ARRAY['reviewer', 'admin', 'moderator'])
  );
