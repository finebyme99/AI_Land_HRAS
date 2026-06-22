-- 062: 默认给普通用户授权“生成飞书卡片”
-- 权限点由 src/lib/permissions/registry.ts 注册，DB 只保存角色 × 权限点分配。
-- 所有用户默认拥有 user 角色，因此授给 user 即对全员默认开放。

INSERT INTO role_permissions(role_key, permission_key)
VALUES ('user', 'resource.generate-feishu-card')
ON CONFLICT (role_key, permission_key) DO NOTHING;
