-- 添加最近活跃时间字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
COMMENT ON COLUMN users.last_active_at IS '用户最近一次登录时间';
