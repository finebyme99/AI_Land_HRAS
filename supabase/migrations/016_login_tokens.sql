-- 016_login_tokens.sql
-- 邮箱魔法链接登录 + 用户名密码登录

-- 1. login_tokens 表（邮箱魔法链接）
CREATE TABLE IF NOT EXISTS login_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_login_tokens_expires ON login_tokens(expires_at);
CREATE INDEX idx_login_tokens_hash ON login_tokens(token_hash);

ALTER TABLE login_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client access to login_tokens" ON login_tokens FOR ALL USING (false);

-- 2. users 表扩展
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;

-- feishu_open_id 改为可空（外部用户没有飞书账号）
ALTER TABLE users ALTER COLUMN feishu_open_id DROP NOT NULL;
