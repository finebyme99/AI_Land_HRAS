# 公开管理员（course_admin）角色设计

**日期**：2026-06-05
**状态**：已批准，待实现

## 背景

当前 /courses 模块的同步、发布、编辑操作只对 admin/moderator 开放，业务方希望把课程模块的运营权下放给专门的"公开课管理员"，但不希望其越权管理其他后台。

## 目标

新增 `course_admin` 角色，赋予公开课模块的同步 / 发布 / 编辑权限，不动其他模块。

## 角色定义

| 项 | 值 |
|----|---|
| DB key | `course_admin` |
| 中文显示 | `公开管理员` |
| 标签颜色 | `blue` |
| 权限范围 | 公开课：同步 / 发布 / 编辑 |
| 不可做 | 删除 / 其他后台模块 / 自身不进入"管理后台"导航子菜单 |

## 实现清单

| 文件 | 改动 |
|------|------|
| `src/lib/auth-context.tsx` | 新增 `isCourseAdmin`、`canManageCourses` 派生值；扩展 `AuthContextType` |
| `src/app/courses/page.tsx` | 顶栏同步/发布按钮（line 189）+ 卡片编辑按钮（line 311）门控改用 `canManageCourses` |
| `src/app/courses/create/page.tsx` | 入口门控改用 `canManageCourses` |
| `src/app/api/courses/route.ts` | `requireAdmin` → `requireCourseEditor`，接受 admin/moderator/course_admin |
| `src/app/api/courses/sync/route.ts` | 角色白名单加 `course_admin` |
| `src/app/admin/users/page.tsx` | `roleOptions` / `roleColors` / `roleLabels` 各加一条 |
| `src/app/api/admin/users/route.ts` | `validRoles` 加 `'course_admin'` |

## 验证矩阵

| 角色 | 同步按钮 | 编辑按钮 | /courses/create | PATCH | sync API |
|------|---------|---------|----------------|-------|---------|
| 无 | ❌ | ❌ | ❌ | ❌ | ❌ |
| `course_admin` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `reviewer` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `admin` / `moderator` | ✅ | ✅ | ✅ | ✅ | ✅ |

## 取舍

- 不新增导航入口：course_admin 在 /courses 页面看到按钮即可
- 不写 DB 迁移：roles 已是 text[]
- 不改 supabase RLS：项目所有权限在 app 层
- 改名 `requireAdmin` → `requireCourseEditor`：旧名在新语义下误导
