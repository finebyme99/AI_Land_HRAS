-- 038: 给 users 表添加 reviewer_roles 字段，存储管理员分配的具体评委角色
-- 评审页面从该字段读取角色，不再让评委自选

ALTER TABLE users ADD COLUMN IF NOT EXISTS reviewer_roles TEXT[] DEFAULT '{}';

COMMENT ON COLUMN users.reviewer_roles IS '管理员分配的评委角色：user（用户评委）、business（业务评委）、tech（技术评委）';
