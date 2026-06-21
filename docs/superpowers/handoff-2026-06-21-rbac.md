# 会话交接文档 — AI岛 RBAC 权限体系

**日期**：2026-06-21
**分支**：main
**阶段**：设计 + 实施计划已完成，**尚未开始编码实现**

---

## 一、本次完成了什么

### 1. 设计 Spec（已提交）
- `docs/superpowers/specs/2026-06-21-rbac-permissions-design.md`
- 提交历史：`908b5dc` → `c24aca7`（按用户决策修订）

### 2. 实施计划（已提交）
- `docs/superpowers/plans/2026-06-21-rbac-permissions.md`
- 提交：`76c6441`
- **14 个 Task，涵盖 DB → API → 前端 → 安全修复 → 自检全流程**

### 3. 关键决策（已锁定，不要改）

| 决策 | 结论 |
|---|---|
| 角色模型 | 支持自定义角色（管理员可在 /admin/roles 新建） |
| 预制角色 | **只 seed `admin` + `user`**，不预制 moderator/course_admin/reviewer/contributor |
| 迁移策略 | 现有用户的 moderator/course_admin/reviewer/contributor **清零为 user**，只有 admin 保留。用户已知悉代价（暂时失去原有权限，待管理员手动重新分配） |
| 权限粒度 | 页面 + 关键操作按钮级（~35 个权限点） |
| 权限点维护 | 代码内声明（`registry.ts`），DB 只存「角色 × 权限点」配置 |
| reviewer_roles | **保持独立不动**（语义是「评分维度授权」，与「页面可见性」正交） |
| isAdmin 老派生值 | 只认 `admin` 角色 key（不再含 moderator），避免自定义角色被误判 |
| /admin/roles 入口 | 仅 admin 可进（防提权） |
| 测试方式 | **无测试框架**，用 curl 验证（遵循 CONTRIBUTING.md 自检规范） |

---

## 二、下一步：执行实施计划

### 执行方式

计划文档头部注明了两种方式（subagent-driven 或 inline execution）。建议用 **subagent-driven**（每个 Task 派一个 agent，完成后 review 再进下一个）。

### 执行顺序

**严格按 Task 1 → 14 顺序执行**，因为依赖关系：
- Task 1（DB 迁移）是所有后续 Task 的前提
- Task 2（registry）→ Task 3（解析层）→ Task 5（auth/me）→ Task 7（auth-context）
- Task 4（类型）可和 Task 2/3 并行
- Task 6（roles API）依赖 Task 1-3
- Task 8-10（前端替换）依赖 Task 7
- Task 11（users 动态化）依赖 Task 6
- Task 12（新页面）依赖 Task 6
- Task 13（安全修复）独立，可在任意时刻做
- Task 14（全站自检）放最后

### 关键文件清单

**新建（8 个文件）**：
| 文件 | 对应 Task |
|---|---|
| `supabase/migrations/057_rbac.sql` | Task 1 |
| `src/lib/permissions/registry.ts` | Task 2 |
| `src/lib/permissions/index.ts` | Task 3 |
| `src/app/api/admin/roles/route.ts` | Task 6 |
| `src/app/api/admin/roles/[key]/route.ts` | Task 6 |
| `src/app/api/admin/roles/[key]/permissions/route.ts` | Task 6 |
| `src/app/admin/roles/page.tsx` | Task 12 |

**修改（~25 个文件）**：
- `src/types/index.ts`（Task 4）
- `src/app/api/auth/me/route.ts`（Task 5）
- `src/lib/auth-context.tsx`（Task 7）
- `src/components/Navigation.tsx`（Task 8）
- 10 个 admin 页面守卫（Task 9）
- ~15 个文件的按钮条件（Task 10）
- `src/app/admin/users/page.tsx` + `src/app/api/admin/users/route.ts`（Task 11）
- 3 个 API 安全修复（Task 13）

---

## 三、项目上下文（给新 agent 的必读）

### 必读文件
1. **`CONTRIBUTING.md`** — 技术栈（Next.js 16 + React 19 + Ant Design 6 + Supabase）、样式规范（Glassmorphism）、自检方式（curl）
2. **`AGENTS.md`** — 分支策略（main 直接开发）、Next.js 16 breaking changes 警告
3. **本实施计划** — `docs/superpowers/plans/2026-06-21-rbac-permissions.md`（每个 Task 有完整代码，可直接复制）
4. **本设计 Spec** — `docs/superpowers/specs/2026-06-21-rbac-permissions-design.md`（理解"为什么"）

### Next.js 16 特殊注意
- 动态路由参数用 `use(params)` 解析（不是 `params.key` 直接取）
- App Router，所有页面都是 `'use client'`
- 见 AGENTS.md 里 "This is NOT the Next.js you know" 的警告

### `requireAdmin` 模式
项目里没有统一的 `requireAdmin` 工具函数——每个 API route 各自定义本地版本（读 cookie → 查 users.roles → 校验含 admin）。RBAC 迁移后新 API（`/api/admin/roles/*`）沿用这个模式。

### 现有工作区状态
- `src/app/competitions/page.tsx` 有未提交的修改（价值星级显示增强，和 RBAC 无关），执行时注意不要 git add -A 误提交
- `feishu-auth-qr.png` 是未跟踪文件，不要提交

---

## 四、扩展性（本期不做，留记录）

**权限申请/审批**：
- 数据模型已预留（`permission_requests` 表 DDL 写在 spec 末尾）
- 权限解析层不用改（审批通过写 `user_roles` 即可）
- 未来实现：`/profile` 加申请入口 → `/admin/roles` 加审批 Tab → 通过写 `user_roles`

**API 鉴权中间件化**：
- 现有各 route 的 `requireAdmin` 是重复代码，未来可抽为统一中间件
- 可基于 `hasPermission(userId, key)` 实现声明式鉴权（如 `withPermission('admin.users')`）

**废弃 users.roles**：
- 当前双向保活（`user_roles` + `users.roles` 同步写）
- 过渡 2 个版本后可彻底废弃 `users.roles` 字段
