-- 058: 默认给所有用户授予 user 角色
-- 057 已执行后，用本迁移补齐所有现有用户的 user 角色，并给后续新用户兜底。

-- 现有用户：user_roles 中全部补一条 user
INSERT INTO user_roles(user_id, role_key)
SELECT id, 'user'
FROM users
ON CONFLICT (user_id, role_key) DO NOTHING;

-- legacy users.roles 也保留 user，避免过渡期依赖 users.roles 的代码读不到默认身份
UPDATE users
SET roles = CASE
  WHEN roles IS NULL OR array_length(roles, 1) IS NULL THEN ARRAY['user']::text[]
  WHEN NOT ('user' = ANY(roles)) THEN ARRAY['user']::text[] || roles
  ELSE roles
END;

-- 写 users.roles 时自动补 user，防止管理员或旧代码把默认角色清掉
CREATE OR REPLACE FUNCTION users_ensure_default_user_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.roles IS NULL OR array_length(NEW.roles, 1) IS NULL THEN
    NEW.roles := ARRAY['user']::text[];
  ELSIF NOT ('user' = ANY(NEW.roles)) THEN
    NEW.roles := ARRAY['user']::text[] || NEW.roles;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_ensure_default_user_role ON users;
CREATE TRIGGER trg_users_ensure_default_user_role
  BEFORE INSERT OR UPDATE OF roles ON users
  FOR EACH ROW EXECUTE FUNCTION users_ensure_default_user_role();

-- 新用户创建后，把 users.roles 中存在于 roles 表的角色同步进 user_roles
CREATE OR REPLACE FUNCTION users_insert_role_links()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_roles(user_id, role_key)
  SELECT NEW.id, role_keys.role_key
  FROM unnest(COALESCE(NEW.roles, ARRAY['user']::text[])) AS role_keys(role_key)
  JOIN roles ON roles.key = role_keys.role_key
  ON CONFLICT (user_id, role_key) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_users_insert_role_links ON users;
CREATE TRIGGER trg_users_insert_role_links
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION users_insert_role_links();
