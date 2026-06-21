-- 057: RBAC 权限管理体系
--   3 张表：roles（角色定义）/ role_permissions（角色×权限点）/ user_roles（用户×角色）
--   参考 spec: docs/superpowers/specs/2026-06-21-rbac-permissions-design.md
--   只 seed admin + user 两个系统角色，其余由管理员在 /admin/roles 自定义

-- ============ 1. roles 表 ============
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roles_key ON roles(key);

-- updated_at 自动维护
CREATE OR REPLACE FUNCTION roles_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_roles_updated_at ON roles;
CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION roles_set_updated_at();

-- ============ 2. role_permissions 表 ============
CREATE TABLE IF NOT EXISTS role_permissions (
  role_key text NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
  permission_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_key, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_key);

-- ============ 3. user_roles 表 ============
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_key text NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
  granted_by uuid REFERENCES users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_key)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_key);

-- ============ 4. Seed 系统角色 ============
INSERT INTO roles(key, label, description, is_system, sort_order) VALUES
  ('admin', '管理员', '拥有全部权限点，权限矩阵中不可取消勾选', true, 0),
  ('user', '普通用户', '默认角色，无管理权限', true, 100)
ON CONFLICT (key) DO NOTHING;

-- ============ 5. 从 users.roles 回填 user_roles ============
-- 所有用户都授予 user；原 roles 含 admin 的用户额外保留 admin
INSERT INTO user_roles(user_id, role_key)
SELECT id, 'user'
FROM users
ON CONFLICT (user_id, role_key) DO NOTHING;

INSERT INTO user_roles(user_id, role_key)
SELECT id, 'admin'
FROM users
WHERE roles IS NOT NULL AND array_length(roles, 1) > 0
  AND 'admin' = ANY(roles)
ON CONFLICT (user_id, role_key) DO NOTHING;

-- 同步清理 legacy users.roles，避免旧 API 在过渡期继续把 moderator/course_admin/reviewer/contributor 当作管理身份
UPDATE users
SET roles = CASE
  WHEN roles IS NOT NULL AND 'admin' = ANY(roles) THEN ARRAY['user', 'admin']::text[]
  ELSE ARRAY['user']::text[]
END;

-- ============ 6. RLS ============
-- roles / role_permissions：所有登录用户可读（前端要读角色列表），admin 可写
-- user_roles：所有登录用户可读自己的，admin 可读写全部

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles read all" ON roles;
CREATE POLICY "roles read all" ON roles FOR SELECT USING (true);
DROP POLICY IF EXISTS "roles admin write" ON roles;
CREATE POLICY "roles admin write" ON roles FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.roles @> ARRAY['admin']::text[]
  )
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "role_permissions read all" ON role_permissions;
CREATE POLICY "role_permissions read all" ON role_permissions FOR SELECT USING (true);
DROP POLICY IF EXISTS "role_permissions admin write" ON role_permissions;
CREATE POLICY "role_permissions admin write" ON role_permissions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.roles @> ARRAY['admin']::text[]
  )
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles read all" ON user_roles;
CREATE POLICY "user_roles read all" ON user_roles FOR SELECT USING (true);
DROP POLICY IF EXISTS "user_roles admin write" ON user_roles;
CREATE POLICY "user_roles admin write" ON user_roles FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.roles @> ARRAY['admin']::text[]
  )
);

COMMENT ON TABLE roles IS '角色定义。is_system=true 的为内置角色不可删（admin/user）。';
COMMENT ON TABLE role_permissions IS '角色 × 权限点分配。permission_key 引用代码内 PERMISSIONS 注册表，无 FK（代码删点后孤儿记录由 API 过滤）。';
COMMENT ON TABLE user_roles IS '用户 × 角色多对多。迁移时从 users.roles 回填，admin 保留，其余清零为 user。';
