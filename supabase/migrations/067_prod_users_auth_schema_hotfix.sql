-- 067: Production auth schema hotfix
-- Current deployed auth code reads users.feishu_tenant_key / users.roles /
-- users.employee_id / users.reviewer_roles. Some production projects may still
-- have the older users schema, so keep this migration idempotent.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT ARRAY['user']::text[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS feishu_tenant_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reviewer_roles TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

ALTER TABLE users ALTER COLUMN feishu_open_id DROP NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_feishu_open_id_key;

UPDATE users
SET roles = ARRAY['user']::text[]
WHERE roles IS NULL OR array_length(roles, 1) IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'role'
  ) THEN
    EXECUTE $sql$
      UPDATE users
      SET roles = CASE
        WHEN role IS NULL OR role = '' THEN roles
        WHEN NOT (role = ANY(roles)) THEN ARRAY[role]::text[] || roles
        ELSE roles
      END
    $sql$;
  END IF;
END $$;

UPDATE users
SET roles = CASE
  WHEN NOT ('user' = ANY(roles)) THEN ARRAY['user']::text[] || roles
  ELSE roles
END;

UPDATE users
SET feishu_tenant_key = '1252bd3caa4fd75d'
WHERE feishu_tenant_key IS NULL
  AND feishu_open_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_openid_uniq
  ON users (feishu_tenant_key, feishu_open_id)
  WHERE feishu_open_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_employee_id_idx
  ON users(employee_id)
  WHERE employee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
  ON users(email)
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
  ON users(username)
  WHERE username IS NOT NULL;

COMMENT ON COLUMN users.reviewer_roles IS '管理员分配的评委角色：user（用户评委）、business（业务评委）、tech（技术评委）';
