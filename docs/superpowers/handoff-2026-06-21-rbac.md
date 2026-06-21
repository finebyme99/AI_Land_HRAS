# 会话交接文档 — AI岛用户权限 / RBAC

**日期**：2026-06-21
**分支**：main
**当前状态**：RBAC 主体已实现并提交，用户管理已合并进「用户权限」模块。

## 已实现

- 数据模型：`roles`、`role_permissions`、`user_roles` 三表，迁移为 `supabase/migrations/057_rbac.sql` 和 `058_default_user_role.sql`。
- 权限注册表：`src/lib/permissions/registry.ts`，权限点在代码内声明，DB 只存角色与权限点 key 的关系。
- 权限类型：每个权限点有 `kind`，`menu` 表示菜单页面，`button` 表示功能按钮；权限矩阵还展示可批量勾选的「功能模块」分组行。
- 权限解析：`src/lib/permissions/index.ts` 提供 `getUserPermissions()`、`hasPermission()` 和缓存清理。
- 前端认证：`useAuth()` 返回 `permissions: Set<string>` 和 `hasPermission(key)`；`isAdmin` 只认 `admin` 角色，`isReviewer` 继续基于 `reviewer_roles`。
- 管理入口：`/admin/roles` 已更名为「用户权限」，包含 `角色列表`、`权限矩阵`、`用户授权` 三个视图。
- 兼容入口：旧 `/admin/users` 保留为重定向，跳到 `/admin/roles?tab=users`。
- 用户授权：原用户管理表格迁入 `src/app/admin/roles/UserAuthorizationTab.tsx`，保留系统角色授权、评委角色批量授权、重置密码。
- 导航：管理后台菜单按 `hasPermission()` 构建，只显示当前用户有权限访问的后台入口。
- API：新增 `/api/admin/roles`、`/api/admin/roles/[key]`、`/api/admin/roles/[key]/permissions`；`/api/admin/users` 修改角色时同步 `user_roles`。

## 当前路由与权限

| 路由 | 说明 | 主要权限 |
|---|---|---|
| `/admin/roles` | 用户权限模块 | `admin.roles` 或 `admin.users` 可进入页面 |
| `/admin/roles?tab=users` | 用户授权视图 | `admin.users` |
| `/admin/users` | 旧入口兼容跳转 | 由 `/admin/roles?tab=users` 接管 |
| `/api/admin/roles` | 角色列表 / 创建角色；`scope=options` 返回下拉选项 | 完整角色管理仍要求 `admin` 身份；`scope=options` 允许 `admin.users` 或 `user.set-roles` |
| `/api/admin/users` | 用户列表、角色授权、评委角色授权、重置密码 | `admin.users`、`user.set-roles`、`user.reset-password` |

## 关键设计约束

- 系统角色只 seed `admin` 和 `user`；其他职能角色由管理员在「用户权限」里自定义。
- `admin` 角色在权限解析层短路为拥有全部权限点，不依赖 `role_permissions` 表。
- `reviewer_roles` 不并入 RBAC，它表示 AI 大赛评分维度授权（用户 / 业务 / 技术评委），与页面和按钮权限正交。
- `users.roles` 仍保留作过渡 fallback，并与 `user_roles` 双向保活；新代码应优先使用 `hasPermission(key)`。
- 权限矩阵的「功能模块」行不入库，只负责批量勾选该模块下的菜单页面和功能按钮；保存时仍写具体权限点 key。

## 已知注意事项

- `src/app/api/admin/roles/route.ts` 的完整角色管理 API 仍以 `admin` 身份为硬门槛，防止拥有 `admin.roles` 权限的自定义角色给自己提权。
- `CONTRIBUTING.md` 是当前项目规范的权威入口；RBAC 详细设计见 `docs/superpowers/specs/2026-06-21-rbac-permissions-design.md`。
- 工作区仍可能存在与 RBAC 无关的未提交改动，提交时不要使用 `git add -A`。

## 自检记录

2026-06-21 已完成：

- `npx eslint` 检查本次相关文件通过，`Navigation.tsx` 仅有既有 `<img>` warning。
- `npm run build` 通过。
- `curl -I --cookie 'feishu_user_id=local-check' http://localhost:3000/admin/roles` 返回 `200`。
- `curl -I --cookie 'feishu_user_id=local-check' http://localhost:3000/admin/users` 返回 `307 -> /admin/roles?tab=users`。
