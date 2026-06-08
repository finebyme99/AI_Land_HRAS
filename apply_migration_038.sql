-- 执行此 SQL 添加 reviewer_roles 字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS reviewer_roles TEXT[] DEFAULT '{}';
COMMENT ON COLUMN users.reviewer_roles IS '管理员分配的评委角色：user（用户评委）、business（业务评委）、tech（技术评委）';
