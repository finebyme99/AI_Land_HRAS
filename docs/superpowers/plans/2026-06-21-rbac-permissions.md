# AI岛 RBAC 权限管理体系 Implementation Plan

> **状态：已实施，仅作历史参考。** 当前实现状态以 `docs/superpowers/handoff-2026-06-21-rbac.md`、`CONTRIBUTING.md` 和代码为准。不要按本文 Task 清单重复执行。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AI岛 实现一套轻量 RBAC 权限体系，支持管理员自定义角色并通过权限矩阵配置每个角色可见的页面和按钮。

**Architecture:** 3 张新表（`roles` / `role_permissions` / `user_roles`）+ 代码内声明的权限点注册表 + 服务端权限解析层。前端 `auth-context` 新增 `hasPermission(key)`，老的 `isAdmin` 等布尔值保留走角色 key 判断。新增 `/admin/roles` 管理页（角色列表 + 权限矩阵）。

**Tech Stack:** Next.js 16 (App Router, 全 `'use client'`)、React 19、Ant Design 6、Supabase (PostgreSQL + RLS)、TypeScript 严格模式。

**测试约定（重要）：** 本项目**无测试框架**（package.json 无 jest/vitest）。遵循 CONTRIBUTING.md 自检规范：每个任务用 `curl` 验证 HTTP 状态码和返回值，不写单测。这是用户指令（AGENTS.md/CONTRIBUTING.md）优先级高于 writing-plans 默认的 TDD。

**关键决策（来自 spec）：**
- roles 表只 seed `admin`（is_system=true）+ `user`（is_system=true）
- 迁移时现有用户的 `moderator`/`course_admin`/`reviewer`/`contributor` 一律清零为 `user`（已知悉代价：暂时失去原有权限，待管理员手动重新分配）
- `reviewer_roles` 保持独立不动
- 权限点清单在代码内声明，DB 只存「角色 × 权限点」配置

**参考文档：** `docs/superpowers/specs/2026-06-21-rbac-permissions-design.md`

---

## 文件结构

### 新建文件
| 文件 | 职责 |
|---|---|
| `supabase/migrations/057_rbac.sql` | 3 张表 + RLS + seed + 从 users.roles 回填 user_roles |
| `src/lib/permissions/registry.ts` | 权限点定义（PERMISSIONS 数组 + PERMISSION_KEYS Set + getPermissionsByGroup） |
| `src/lib/permissions/index.ts` | 服务端权限解析（getUserPermissions + hasPermission + 请求级缓存） |
| `src/app/api/admin/roles/route.ts` | GET 列出角色 / POST 新建角色 |
| `src/app/api/admin/roles/[key]/route.ts` | PATCH 改角色 / DELETE 删角色 |
| `src/app/api/admin/roles/[key]/permissions/route.ts` | PUT 覆盖角色权限点 |
| `src/app/admin/roles/page.tsx` | 角色管理页（Tab1 角色列表 + Tab2 权限矩阵） |

### 修改文件
| 文件 | 改动 |
|---|---|
| `src/types/index.ts` | User 接口加 `permissions?: string[]`；新增 Role / RoleWithPermissions 类型 |
| `src/app/api/auth/me/route.ts` | 返回里加 `permissions` 字段 |
| `src/lib/auth-context.tsx` | 加 `permissions: Set<string>` + `hasPermission(key)`；老派生值改基于角色 key |
| `src/components/Navigation.tsx` | 管理后台菜单用 hasPermission；提取 buildAdminMenu() 消除重复 |
| `src/app/admin/users/page.tsx` | roleOptions 从 /api/admin/roles 动态读取 |
| `src/app/api/admin/users/route.ts` | PATCH 角色时同步写 user_roles 表 |
| 10 个 admin 页面 | 顶部守卫改用 hasPermission |
| ~20 处按钮 | 条件渲染改用 hasPermission |
| 3 个 API route | 补 requireAdmin（安全修复） |

---

## Task 1: 数据库迁移 057_rbac.sql

**Files:**
- Create: `supabase/migrations/057_rbac.sql`

- [ ] **Step 1: 写迁移文件**

创建 `supabase/migrations/057_rbac.sql`：

```sql
-- 057: RBAC 权限管理体系
--   3 张表：roles（角色定义）/ role_permissions（角色×权限点）/ user_roles（用户×角色）
--   参考 spec: docs/superpowers/specs/2026-06-21-rbac-permissions-design.md
--   只 seed admin + user 两个系统角色，其余由管理员在 /admin/roles 自定义

-- ============ 1. roles 表 ============
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roles_key ON roles(key);

-- updated_at 自动维护
CREATE OR REPLACE FUNCTION roles_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_roles_updated_at ON roles;
CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION roles_set_updated_at();

-- ============ 2. role_permissions 表 ============
CREATE TABLE IF NOT EXISTS role_permissions (
  role_key text NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
  permission_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_key, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_key);

-- ============ 3. user_roles 表 ============
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_key text NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
  granted_by uuid REFERENCES users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_key)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_key);

-- ============ 4. Seed 系统角色 ============
INSERT INTO roles(key, label, description, is_system, sort_order) VALUES
  ('admin', '管理员', '拥有全部权限点，权限矩阵中不可取消勾选', true, 0),
  ('user', '普通用户', '默认角色，无管理权限', true, 100)
ON CONFLICT (key) DO NOTHING;

-- ============ 5. 从 users.roles 回填 user_roles ============
-- 现有 moderator/course_admin/reviewer/contributor 一律清零为 user
-- 只有 admin 保留为 admin
INSERT INTO user_roles(user_id, role_key)
SELECT id,
       CASE WHEN 'admin' = ANY(roles) THEN 'admin' ELSE 'user' END
FROM users
WHERE roles IS NOT NULL AND array_length(roles, 1) > 0
ON CONFLICT (user_id, role_key) DO NOTHING;

-- ============ 6. RLS ============
-- roles / role_permissions：所有登录用户可读（前端要读角色列表），admin 可写
-- user_roles：所有登录用户可读自己的，admin 可读写全部

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles read all" ON roles;
CREATE POLICY "roles read all" ON roles FOR SELECT USING (true);
DROP POLICY IF EXISTS "roles admin write" ON roles;
CREATE POLICY "roles admin write" ON roles FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.roles @> ARRAY['admin']::text[]
  )
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "role_permissions read all" ON role_permissions;
CREATE POLICY "role_permissions read all" ON role_permissions FOR SELECT USING (true);
DROP POLICY IF EXISTS "role_permissions admin write" ON role_permissions;
CREATE POLICY "role_permissions admin write" ON role_permissions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.roles @> ARRAY['admin']::text[]
  )
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles read all" ON user_roles;
CREATE POLICY "user_roles read all" ON user_roles FOR SELECT USING (true);
DROP POLICY IF EXISTS "user_roles admin write" ON user_roles;
CREATE POLICY "user_roles admin write" ON user_roles FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.roles @> ARRAY['admin']::text[]
  )
);

COMMENT ON TABLE roles IS '角色定义。is_system=true 的为内置角色不可删（admin/user）。';
COMMENT ON TABLE role_permissions IS '角色 × 权限点分配。permission_key 引用代码内 PERMISSIONS 注册表，无 FK（代码删点后孤儿记录由 API 过滤）。';
COMMENT ON TABLE user_roles IS '用户 × 角色多对多。迁移时从 users.roles 回填，admin 保留，其余清零为 user。';
```

- [ ] **Step 2: 在 Supabase Dashboard SQL Editor 执行迁移**

由于本项目迁移手动执行（见 CONTRIBUTING.md），开发者需登录 Supabase Dashboard，打开 SQL Editor，粘贴 057_rbac.sql 全文运行。

验证执行无报错。

- [ ] **Step 3: curl 验证表已创建（需用 service role key 或在 Dashboard 查）**

在 Supabase Dashboard 的 Table Editor 或 SQL Editor 验证：
```sql
SELECT key, label, is_system FROM roles ORDER BY sort_order;
-- 预期：2 行 admin / user

SELECT COUNT(*) FROM user_roles;
-- 预期：= 现有 users 表中有 roles 的用户数

SELECT user_id, role_key FROM user_roles WHERE role_key = 'admin';
-- 预期：只有原 roles 含 'admin' 的用户
```

- [ ] **Step 4: 提交**

```bash
git add supabase/migrations/057_rbac.sql
git commit -m "feat: RBAC 迁移 057——roles/role_permissions/user_roles 三表 + seed admin/user + 回填 user_roles"
```

---

## Task 2: 权限点注册表 registry.ts

**Files:**
- Create: `src/lib/permissions/registry.ts`

- [ ] **Step 1: 写权限点注册表**

创建 `src/lib/permissions/registry.ts`：

```ts
// 权限点注册表
// 所有权限点在代码内声明，DB 的 role_permissions 表只存「角色 × 权限点 key」的分配关系。
// 代码删除某权限点后，DB 残留的孤儿记录由权限解析层（index.ts）用 PERMISSION_KEYS 过滤掉。

export interface PermissionDef {
  key: string; // 'admin.users'
  label: string; // '用户管理页'
  group: string; // '管理后台'（权限矩阵分组显示用）
  description?: string;
}

export const PERMISSIONS: PermissionDef[] = [
  // ===== 前台导航 =====
  { key: 'nav.home', label: '首页', group: '前台导航' },
  { key: 'nav.wish-pool', label: '场景大全', group: '前台导航' },
  { key: 'nav.competitions', label: 'AI大赛', group: '前台导航' },
  { key: 'nav.resources', label: '课程资源', group: '前台导航' },

  // ===== 管理后台页面 =====
  { key: 'admin.reviews', label: '评审管理', group: '管理后台' },
  { key: 'admin.review', label: '内容审核', group: '管理后台' },
  { key: 'admin.users', label: '用户管理', group: '管理后台' },
  { key: 'admin.bitable-field-map', label: '字段映射配置', group: '管理后台' },
  { key: 'admin.layouts', label: '方案卡片布局', group: '管理后台' },
  { key: 'admin.reminders', label: '提醒管理', group: '管理后台' },
  { key: 'admin.push', label: '飞书推送', group: '管理后台' },
  { key: 'admin.feishu-apps', label: '飞书应用配置', group: '管理后台' },
  { key: 'admin.settings', label: '平台设置', group: '管理后台' },
  { key: 'admin.roles', label: '角色与权限', group: '管理后台' },

  // ===== 课程模块 =====
  { key: 'course.sync', label: '课程同步飞书', group: '课程模块' },
  { key: 'course.publish', label: '课程发布/编辑', group: '课程模块' },

  // ===== 大赛评审 =====
  { key: 'review.score', label: '评审打分', group: '大赛评审' },
  { key: 'review.export', label: '评审记录导出 CSV', group: '大赛评审' },
  { key: 'review.sync-feishu', label: '评审进度同步飞书', group: '大赛评审' },
  { key: 'review.clear-reviewer', label: '清空评委评分', group: '大赛评审' },
  { key: 'competition.sync', label: '大赛数据同步飞书', group: '大赛评审' },
  { key: 'dashboard.export-image', label: '效果看板导出图片', group: '大赛评审' },

  // ===== 场景池 =====
  { key: 'case.feature', label: '标精选', group: '场景池' },
  { key: 'case.submit', label: '提交案例', group: '场景池' },
  { key: 'wishpool.export-image', label: '场景大全导出图片', group: '场景池' },

  // ===== 资源 =====
  { key: 'resource.submit', label: '提交工具', group: '资源' },
  { key: 'resource.review', label: '内容审核通过/驳回', group: '资源' },

  // ===== 用户管理 =====
  { key: 'user.reset-password', label: '重置密码', group: '用户管理' },
  { key: 'user.set-roles', label: '修改他人角色', group: '用户管理' },

  // ===== 字段映射 =====
  { key: 'fieldmap.sync', label: '字段映射同步飞书', group: '字段映射' },

  // ===== 提醒 =====
  { key: 'reminder.send', label: '提醒发送', group: '提醒' },

  // ===== 推送 =====
  { key: 'push.send', label: '飞书群推送', group: '推送' },

  // ===== 布局 =====
  { key: 'layout.edit', label: '布局编辑保存', group: '布局' },

  // ===== 飞书应用 =====
  { key: 'feishu-app.manage', label: '飞书应用增删改', group: '飞书应用' },

  // ===== 平台设置 =====
  { key: 'settings.save', label: '平台设置保存', group: '平台设置' },
];

export const PERMISSION_KEYS = new Set(PERMISSIONS.map((p) => p.key));

/** 按分组返回权限点（给 /admin/roles 矩阵 UI 用） */
export function getPermissionsByGroup(): Record<string, PermissionDef[]> {
  const grouped: Record<string, PermissionDef[]> = {};
  for (const p of PERMISSIONS) {
    if (!grouped[p.group]) grouped[p.group] = [];
    grouped[p.group].push(p);
  }
  return grouped;
}

/** 获取权限点的 label（给前端展示用） */
export function getPermissionLabel(key: string): string {
  return PERMISSIONS.find((p) => p.key === key)?.label ?? key;
}
```

- [ ] **Step 2: 验证 TypeScript 编译无误**

Run: `npx tsc --noEmit`
Expected: 无新增报错（可能有既有的无关报错，只关注 permissions/registry.ts 相关）

- [ ] **Step 3: 提交**

```bash
git add src/lib/permissions/registry.ts
git commit -m "feat: 权限点注册表 registry.ts——35 个权限点定义"
```

---

## Task 3: 权限解析层 index.ts

**Files:**
- Create: `src/lib/permissions/index.ts`

- [ ] **Step 1: 写权限解析层**

创建 `src/lib/permissions/index.ts`：

```ts
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { PERMISSION_KEYS } from './registry';

// 请求级缓存：避免一次请求里多次查询
// key = userId，value = Promise<Set<string>>（用 Promise 缓存避免并发重复查询）
const requestCache = new Map<string, Promise<Set<string>>>();

/**
 * 聚合用户拥有的所有权限点 key。
 * 1. 查 user_roles → role_keys[]
 * 2. 若含 'admin' → 直接返回 PERMISSION_KEYS 全集（短路）
 * 3. 否则查 role_permissions WHERE role_key IN (...) → permission_keys[]
 * 4. 用 PERMISSION_KEYS 过滤掉代码已删除的孤儿 key
 */
export async function getUserPermissions(userId: string): Promise<Set<string>> {
  // 命中缓存直接返回
  const cached = requestCache.get(userId);
  if (cached) return cached;

  const promise = computeUserPermissions(userId);
  requestCache.set(userId, promise);
  try {
    return await promise;
  } finally {
    // 请求结束后清理（Node 单进程下，下次请求重新查）
    // 注：Next.js route handler 每次请求是新执行上下文，这里额外兜底
    requestCache.delete(userId);
  }
}

async function computeUserPermissions(userId: string): Promise<Set<string>> {
  const supabase = getSupabaseAdmin();

  // 1. 查用户的角色
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role_key')
    .eq('user_id', userId);

  const roleKeys = (userRoles ?? []).map((r) => r.role_key);

  // 2. admin 短路
  if (roleKeys.includes('admin')) {
    return new Set(PERMISSION_KEYS);
  }

  // 3. 查角色权限点
  if (roleKeys.length === 0) return new Set();

  const { data: rolePerms } = await supabase
    .from('role_permissions')
    .select('permission_key')
    .in('role_key', roleKeys);

  // 4. 过滤孤儿 key（代码已删除的权限点）
  const result = new Set<string>();
  for (const rp of rolePerms ?? []) {
    if (PERMISSION_KEYS.has(rp.permission_key)) {
      result.add(rp.permission_key);
    }
  }
  return result;
}

/** 判断单个权限点（服务端用） */
export async function hasPermission(userId: string, key: string): Promise<boolean> {
  const perms = await getUserPermissions(userId);
  return perms.has(key);
}

/** 清除缓存（角色/权限变更后调用，确保下次读取最新） */
export function clearPermissionsCache(userId?: string) {
  if (userId) {
    requestCache.delete(userId);
  } else {
    requestCache.clear();
  }
}
```

- [ ] **Step 2: 验证 TypeScript 编译无误**

Run: `npx tsc --noEmit`
Expected: 无 permissions/index.ts 相关报错

- [ ] **Step 3: 提交**

```bash
git add src/lib/permissions/index.ts
git commit -m "feat: 权限解析层——getUserPermissions + hasPermission + 请求级缓存"
```

---

## Task 4: 类型定义更新

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: User 接口加 permissions 字段**

在 `src/types/index.ts` 的 `User` 接口里（第 28-44 行附近），在 `last_active_at` 后加一行：

```ts
  last_active_at?: string | null;
  permissions?: string[]; // 用户拥有的权限点 key 列表（来自 /api/auth/me）
```

- [ ] **Step 2: 在文件末尾加 Role 相关类型**

在 `src/types/index.ts` 末尾追加：

```ts
// ============ RBAC 角色 ============
export interface Role {
  key: string;
  label: string;
  description: string | null;
  is_system: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** 角色带聚合信息（给 /admin/roles 列表用） */
export interface RoleWithStats extends Role {
  permission_count: number;
  user_count: number;
  permissions: string[];
}
```

- [ ] **Step 3: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无报错

- [ ] **Step 4: 提交**

```bash
git add src/types/index.ts
git commit -m "feat: 类型定义——User.permissions + Role/RoleWithStats"
```

---

## Task 5: /api/auth/me 加 permissions 字段

**Files:**
- Modify: `src/app/api/auth/me/route.ts`

- [ ] **Step 1: 改造 me 接口**

把 `src/app/api/auth/me/route.ts` 整个 GET 函数替换为：

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getUserPermissions } from '@/lib/permissions';

// GET /api/auth/me — 获取当前登录用户信息（含权限点）
export async function GET(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id');

  if (!userId) {
    return NextResponse.json({ user: null });
  }

  try {
    const { data: user } = await getSupabaseAdmin()
      .from('users')
      .select('id, feishu_open_id, feishu_tenant_key, employee_id, username, name, avatar, department, roles, reviewer_roles, bio, points, level, created_at, last_active_at')
      .eq('id', userId.value)
      .single();

    if (!user) {
      const response = NextResponse.json({ user: null });
      response.cookies.delete('feishu_user_id');
      response.cookies.delete('feishu_user_info');
      return response;
    }

    // 查权限点
    const permissions = await getUserPermissions(user.id);

    return NextResponse.json({ user: { ...user, permissions: [...permissions] } });
  } catch {
    return NextResponse.json({ user: null });
  }
}
```

注意：相比原代码，select 字段补全了 `feishu_tenant_key, employee_id, username, last_active_at`（对齐 User 类型），并新增 permissions 查询。

- [ ] **Step 2: 启动 dev server 并 curl 验证**

Run: `npx next dev`（如未启动）

```bash
# 先用 admin 账号登录拿 cookie（或从浏览器复制 feishu_user_id cookie）
# 这里假设已有 cookie，验证返回结构
curl -s http://localhost:3000/api/auth/me -H "Cookie: feishu_user_id=<ADMIN_USER_ID>" | python3 -m json.tool
```

Expected: 返回的 user 对象里有 `permissions` 数组，admin 用户应为全部 35 个权限点。

```bash
# 普通用户（迁移后清零为 user）
curl -s http://localhost:3000/api/auth/me -H "Cookie: feishu_user_id=<NORMAL_USER_ID>" | python3 -m json.tool
```

Expected: `permissions` 为空数组 `[]`。

- [ ] **Step 3: 提交**

```bash
git add src/app/api/auth/me/route.ts
git commit -m "feat: /api/auth/me 返回 permissions 权限点列表"
```

---

## Task 6: /api/admin/roles 全套 API

**Files:**
- Create: `src/app/api/admin/roles/route.ts`
- Create: `src/app/api/admin/roles/[key]/route.ts`
- Create: `src/app/api/admin/roles/[key]/permissions/route.ts`

- [ ] **Step 1: 写 roles/route.ts（GET 列出 / POST 新建）**

创建 `src/app/api/admin/roles/route.ts`：

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { PERMISSION_KEYS } from '@/lib/permissions/registry';
import type { RoleWithStats } from '@/types';

// 验证 admin 权限
async function requireAdmin(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;
  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id, roles')
    .eq('id', userId)
    .single();
  if (!user || !user.roles?.includes('admin')) return null;
  return user;
}

// GET /api/admin/roles — 列出所有角色 + 权限点 + 用户数
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  const { data: roles, error } = await supabase
    .from('roles')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: '获取角色失败' }, { status: 500 });
  }

  // 查每个角色的权限点
  const { data: rolePerms } = await supabase
    .from('role_permissions')
    .select('role_key, permission_key');

  // 查每个角色的用户数
  const { data: userCounts } = await supabase
    .from('user_roles')
    .select('role_key');

  const permsByRole: Record<string, string[]> = {};
  for (const rp of rolePerms ?? []) {
    if (!permsByRole[rp.role_key]) permsByRole[rp.role_key] = [];
    permsByRole[rp.role_key].push(rp.permission_key);
  }

  const countByRole: Record<string, number> = {};
  for (const uc of userCounts ?? []) {
    countByRole[uc.role_key] = (countByRole[uc.role_key] ?? 0) + 1;
  }

  const result: RoleWithStats[] = (roles ?? []).map((r) => ({
    ...r,
    permissions: r.key === 'admin' ? [...PERMISSION_KEYS] : (permsByRole[r.key] ?? []),
    permission_count: r.key === 'admin' ? PERMISSION_KEYS.size : (permsByRole[r.key]?.length ?? 0),
    user_count: countByRole[r.key] ?? 0,
  }));

  return NextResponse.json({ roles: result });
}

// POST /api/admin/roles — 新建自定义角色
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { key, label, description } = body;

    if (!key || !label) {
      return NextResponse.json({ error: 'key 和 label 必填' }, { status: 400 });
    }

    // key 格式校验：小写字母/数字/下划线
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      return NextResponse.json({ error: 'key 只能包含小写字母、数字、下划线，且以字母开头' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('roles')
      .insert({ key, label, description: description ?? null, is_system: false })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '角色 key 已存在' }, { status: 409 });
      }
      return NextResponse.json({ error: '创建失败' }, { status: 500 });
    }

    return NextResponse.json({ role: data });
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
}
```

- [ ] **Step 2: 写 roles/[key]/route.ts（PATCH 改 / DELETE 删）**

创建 `src/app/api/admin/roles/[key]/route.ts`：

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { use } from 'react';

// 验证 admin
async function requireAdmin(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;
  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id, roles')
    .eq('id', userId)
    .single();
  if (!user || !user.roles?.includes('admin')) return null;
  return user;
}

// PATCH /api/admin/roles/[key] — 改 label/description（系统角色 key 不可改）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const { key } = use(params);

  try {
    const body = await request.json();
    const { label, description } = body;

    const updates: { label?: string; description?: string | null } = {};
    if (label !== undefined) updates.label = label;
    if (description !== undefined) updates.description = description;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '无更新字段' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('roles')
      .update(updates)
      .eq('key', key)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: '更新失败或角色不存在' }, { status: 404 });
    }

    return NextResponse.json({ role: data });
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
}

// DELETE /api/admin/roles/[key] — 删除自定义角色（系统角色禁删）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const { key } = use(params);

  const supabase = getSupabaseAdmin();

  // 先查角色是否为系统角色
  const { data: role } = await supabase
    .from('roles')
    .select('is_system')
    .eq('key', key)
    .single();

  if (!role) {
    return NextResponse.json({ error: '角色不存在' }, { status: 404 });
  }

  if (role.is_system) {
    return NextResponse.json({ error: '系统角色不可删除' }, { status: 400 });
  }

  // ON DELETE CASCADE 会自动清理 role_permissions 和 user_roles 中的关联
  const { error } = await supabase.from('roles').delete().eq('key', key);

  if (error) {
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

注意：Next.js 16 用 `use(params)` 解析动态路由参数（见 AGENTS.md）。

- [ ] **Step 3: 写 roles/[key]/permissions/route.ts（PUT 覆盖权限点）**

创建 `src/app/api/admin/roles/[key]/permissions/route.ts`：

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { use } from 'react';
import { PERMISSION_KEYS } from '@/lib/permissions/registry';

// 验证 admin
async function requireAdmin(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;
  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id, roles')
    .eq('id', userId)
    .single();
  if (!user || !user.roles?.includes('admin')) return null;
  return user;
}

// PUT /api/admin/roles/[key]/permissions — 覆盖该角色的权限点清单
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const { key } = use(params);

  // admin 角色不写表（解析时短路返回全集）
  if (key === 'admin') {
    return NextResponse.json({ success: true, skipped: true });
  }

  try {
    const body = await request.json();
    const { permissionKeys } = body as { permissionKeys: string[] };

    if (!Array.isArray(permissionKeys)) {
      return NextResponse.json({ error: 'permissionKeys 必须是数组' }, { status: 400 });
    }

    // 过滤掉不存在的权限点 key
    const validKeys = permissionKeys.filter((k) => PERMISSION_KEYS.has(k));

    const supabase = getSupabaseAdmin();

    // 先删后插（覆盖语义）
    await supabase.from('role_permissions').delete().eq('role_key', key);

    if (validKeys.length > 0) {
      const rows = validKeys.map((pk) => ({ role_key: key, permission_key: pk }));
      const { error } = await supabase.from('role_permissions').insert(rows);
      if (error) {
        return NextResponse.json({ error: '保存失败' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, count: validKeys.length });
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
}
```

- [ ] **Step 4: curl 验证全套 API**

```bash
# GET 列出角色（用 admin cookie）
curl -s http://localhost:3000/api/admin/roles -H "Cookie: feishu_user_id=<ADMIN_USER_ID>" | python3 -m json.tool
# 预期：roles 数组含 admin（permissions 全集，permission_count=35）和 user（空 permissions）

# POST 新建测试角色
curl -s -X POST http://localhost:3000/api/admin/roles \
  -H "Cookie: feishu_user_id=<ADMIN_USER_ID>" \
  -H "Content-Type: application/json" \
  -d '{"key":"test_editor","label":"测试编辑","description":"临时测试"}' | python3 -m json.tool
# 预期：返回 role 对象，is_system=false

# PUT 配置权限点
curl -s -X PUT http://localhost:3000/api/admin/roles/test_editor/permissions \
  -H "Cookie: feishu_user_id=<ADMIN_USER_ID>" \
  -H "Content-Type: application/json" \
  -d '{"permissionKeys":["admin.review","case.feature"]}' | python3 -m json.tool
# 预期：{"success":true,"count":2}

# DELETE 删除测试角色
curl -s -X DELETE http://localhost:3000/api/admin/roles/test_editor \
  -H "Cookie: feishu_user_id=<ADMIN_USER_ID>" | python3 -m json.tool
# 预期：{"success":true}

# DELETE 系统角色应失败
curl -s -X DELETE http://localhost:3000/api/admin/roles/user \
  -H "Cookie: feishu_user_id=<ADMIN_USER_ID>" | python3 -m json.tool
# 预期：{"error":"系统角色不可删除"}，status 400
```

- [ ] **Step 5: 提交**

```bash
git add src/app/api/admin/roles/
git commit -m "feat: /api/admin/roles 全套——GET/POST/PATCH/DELETE + PUT permissions"
```

---

## Task 7: auth-context 加 permissions + hasPermission

**Files:**
- Modify: `src/lib/auth-context.tsx`

- [ ] **Step 1: 改造 auth-context**

把 `src/lib/auth-context.tsx` 整体替换为：

```tsx
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isReviewer: boolean;
  isCourseAdmin: boolean;
  canManageCourses: boolean;
  permissions: Set<string>;
  hasPermission: (key: string) => boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  isReviewer: false,
  isCourseAdmin: false,
  canManageCourses: false,
  permissions: new Set(),
  hasPermission: () => false,
  signOut: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      setUser(data.user || null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    fetchUser().finally(() => setLoading(false));
  }, [fetchUser]);

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  // 权限点集合（来自 /api/auth/me 的 permissions 字段）
  const permissions = new Set(user?.permissions ?? []);
  const hasPermission = useCallback((key: string) => permissions.has(key), [permissions]);

  // 老派生值：基于角色 key 判断（不走权限点，避免自定义角色被误判）
  // 注意：迁移后现有 moderator/course_admin 已清零为 user，这些值对他们会暂时为 false
  // 新代码应优先用 hasPermission()
  const isAdmin = !!user?.roles?.includes('admin');
  const isCourseAdmin = !!user?.roles?.includes('course_admin');
  // reviewer 判定：admin 继承，或 users.reviewer_roles 有分配角色（独立维度）
  const isReviewer = isAdmin || (user?.reviewer_roles?.length ?? 0) > 0;
  const canManageCourses = isAdmin || isCourseAdmin;

  return (
    <AuthContext.Provider
      value={{ user, loading, isAdmin, isReviewer, isCourseAdmin, canManageCourses, permissions, hasPermission, signOut, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

关键变化：
1. `AuthContextType` 加 `permissions: Set<string>` 和 `hasPermission`
2. `isAdmin` 从 `['admin','moderator'].includes(r)` 改为只认 `admin`（moderator 已不预制）
3. `hasPermission` 用 `useCallback` 包裹，依赖 permissions

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无报错（老代码读 `isAdmin` 等仍能工作，因为字段保留）

- [ ] **Step 3: curl 验证 auth-context 改动不影响现有登录**

```bash
curl -s http://localhost:3000/api/auth/me -H "Cookie: feishu_user_id=<ADMIN_USER_ID>" | python3 -c "import sys,json; d=json.load(sys.stdin); print('permissions count:', len(d.get('user',{}).get('permissions',[])))"
# 预期：permissions count: 35
```

- [ ] **Step 4: 提交**

```bash
git add src/lib/auth-context.tsx
git commit -m "feat: auth-context 加 permissions/hasPermission，isAdmin 改基于 admin 角色 key"
```

---

## Task 8: Navigation.tsx 管理后台菜单改用 hasPermission

**Files:**
- Modify: `src/components/Navigation.tsx`

- [ ] **Step 1: 提取 buildAdminMenu 并改用 hasPermission**

在 `src/components/Navigation.tsx` 中，把组件顶部 `navItems` 数组下面（第 33 行后）加一个辅助函数。同时在 `useAuth()` 解构里加 `hasPermission`。

改 `useAuth()` 解构（原第 38 行）：

```tsx
const { user, loading, isAdmin, isReviewer, hasPermission, signOut } = useAuth();
```

在 `navItems`/`userMenuItems` 定义后、`export default function Navigation()` 前加：

```tsx
/** 构建管理后台菜单项（Desktop 和 Mobile 共用，消除重复） */
function buildAdminMenu(hasPermission: (key: string) => boolean, onNavigate?: () => void) {
  const link = (href: string, label: string) => (
    <Link href={href} onClick={onNavigate}>{label}</Link>
  );
  const items: { key: string; label: React.ReactNode }[] = [];

  // 评审类（reviewer 可见）
  if (hasPermission('admin.reviews')) {
    items.push({ key: '/admin/reviews', label: link('/admin/reviews', '评审管理') });
  }
  // 管理类
  const adminItems: { key: string; label: React.ReactNode }[] = [];
  if (hasPermission('admin.review')) adminItems.push({ key: '/admin/review', label: link('/admin/review', '内容审核') });
  if (hasPermission('admin.users')) adminItems.push({ key: '/admin/users', label: link('/admin/users', '用户管理') });
  if (hasPermission('admin.roles')) adminItems.push({ key: '/admin/roles', label: link('/admin/roles', '角色与权限') });
  if (hasPermission('admin.bitable-field-map')) adminItems.push({ key: '/admin/bitable-field-map', label: link('/admin/bitable-field-map', '字段映射配置') });
  if (hasPermission('admin.layouts')) adminItems.push({ key: '/admin/layouts/competitions-entry-card', label: link('/admin/layouts/competitions-entry-card', '方案卡片布局') });
  if (hasPermission('admin.reminders')) adminItems.push({ key: '/admin/reminders', label: link('/admin/reminders', '提醒管理') });
  if (hasPermission('admin.push')) adminItems.push({ key: '/admin/push', label: link('/admin/push', '飞书推送') });
  if (hasPermission('admin.feishu-apps')) adminItems.push({ key: '/admin/feishu-apps', label: link('/admin/feishu-apps', '飞书应用配置') });
  if (hasPermission('admin.settings')) adminItems.push({ key: '/admin/settings', label: link('/admin/settings', '平台设置') });

  return [...items, ...adminItems];
}
```

- [ ] **Step 2: 替换 Desktop Dropdown 里的管理后台菜单**

在 Desktop Dropdown 的 menu.items 里（原第 120-140 行），把整个 `...(isAdmin || isReviewer ? [...] : [])` 块替换为：

```tsx
...(([...permissions].some((k) => k.startsWith('admin.')))
  ? [{
      key: 'admin',
      label: '管理后台',
      icon: <TeamOutlined />,
      children: buildAdminMenu(hasPermission),
    }]
  : []),
```

判断逻辑：只要用户拥有任意 `admin.*` 权限点，就显示「管理后台」入口；具体菜单项由 `buildAdminMenu` 根据 `hasPermission` 逐项过滤。

需要在 `useAuth()` 解构里加 `permissions`：

```tsx
const { user, loading, isAdmin, isReviewer, permissions, hasPermission, signOut } = useAuth();
```

注意：`isAdmin`/`isReviewer` 解构出来即使本次改动不直接用，也保留（避免删除后其他逻辑引用报错；TS 未使用的变量在 lint 里可能是 warning，可接受）。

- [ ] **Step 3: 替换 Mobile Drawer 里的管理后台菜单**

在 Mobile Drawer 的 Menu items 里（原第 232-252 行），把同样的 `...(isAdmin || isReviewer ? [...] : [])` 块替换为：

```tsx
...(([...permissions].some(k => k.startsWith('admin.')))
  ? [{
      key: 'admin',
      label: '管理后台',
      icon: <TeamOutlined />,
      children: buildAdminMenu(hasPermission, () => setDrawerOpen(false)),
    }]
  : []),
```

- [ ] **Step 4: 浏览器验证**

打开 `http://localhost:3000`，用 admin 账号登录：
- 预期：头像下拉里「管理后台」展开后显示全部 11 个菜单项（含新增的「角色与权限」）
- 普通账号登录：下拉里无「管理后台」入口

- [ ] **Step 5: 提交**

```bash
git add src/components/Navigation.tsx
git commit -m "feat: Navigation 管理后台菜单改用 hasPermission + 提取 buildAdminMenu 消除重复"
```

---

## Task 9: admin 各页面顶部守卫改用 hasPermission

**Files:**
- Modify: `src/app/admin/reviews/page.tsx`
- Modify: `src/app/admin/review/page.tsx`
- Modify: `src/app/admin/users/page.tsx`
- Modify: `src/app/admin/bitable-field-map/page.tsx`
- Modify: `src/app/admin/layouts/competitions-entry-card/page.tsx`
- Modify: `src/app/admin/reminders/page.tsx`
- Modify: `src/app/admin/push/page.tsx`
- Modify: `src/app/admin/feishu-apps/page.tsx`
- Modify: `src/app/admin/settings/page.tsx`

- [ ] **Step 1: 逐一改 admin 页面守卫**

每个 admin 页面的模式相同。以 `src/app/admin/settings/page.tsx` 为例（最简单的）：

原代码：
```tsx
const { isAdmin, loading: authLoading } = useAuth();
// ...
useEffect(() => {
  if (!authLoading && !isAdmin) router.replace('/');
}, [authLoading, isAdmin, router]);
// ...
if (authLoading || !isAdmin) {
  return <Spin .../>;
}
```

改为：
```tsx
const { hasPermission, loading: authLoading } = useAuth();
const canView = hasPermission('admin.settings');
// ...
useEffect(() => {
  if (!authLoading && !canView) router.replace('/');
}, [authLoading, canView, router]);
// ...
if (authLoading || !canView) {
  return <Spin .../>;
}
```

每个页面用的权限点 key：
| 页面 | 权限点 |
|---|---|
| admin/reviews | `admin.reviews` |
| admin/review | `admin.review` |
| admin/users | `admin.users` |
| admin/bitable-field-map | `admin.bitable-field-map` |
| admin/layouts/competitions-entry-card | `admin.layouts` |
| admin/reminders | `admin.reminders` |
| admin/push | `admin.push` |
| admin/feishu-apps | `admin.feishu-apps` |
| admin/settings | `admin.settings` |

**注意 admin/users 页面**（`src/app/admin/users/page.tsx`）：它原本用 `isAdmin`，除了守卫还在表格行操作里用 `isAdmin` 判断（如禁用自身角色编辑）。守卫改成 `hasPermission('admin.users')`，行内的 `isAdmin` 判断保留（用于"是否 admin 身份"语义，不是"是否能进本页"）。

**注意 admin/feishu-apps 和 admin/layouts 页面**：原代码**没有**前端守卫（盘点发现的缺失），本任务顺带补上守卫。

- [ ] **Step 2: 浏览器验证 admin 账号可进各页面**

admin 账号登录，逐个访问 `/admin/settings`、`/admin/users` 等，确认正常显示。

- [ ] **Step 3: 浏览器验证普通用户被重定向**

普通账号登录，手动访问 `/admin/settings`，预期被重定向到首页。

- [ ] **Step 4: 提交**

```bash
git add src/app/admin/
git commit -m "feat: 10 个 admin 页面守卫改用 hasPermission（顺带补 feishu-apps/layouts 缺失守卫）"
```

---

## Task 10: 关键按钮条件渲染改用 hasPermission

**Files:**
- Modify: `src/app/resources/courses/page.tsx`（course.sync / course.publish）
- Modify: `src/app/resources/courses/create/page.tsx`（course.publish）
- Modify: `src/app/resources/apps/page.tsx`（resource.review 相关，用 isAdmin 的地方）
- Modify: `src/app/wish-pool/page.tsx`（wishpool.export-image）
- Modify: `src/app/competitions/page.tsx`（competition.submit / dashboard 相关）
- Modify: `src/components/ChoDashboard.tsx`（competition.sync / dashboard.export-image）
- Modify: `src/components/CompetitionCard.tsx`（review.score）
- Modify: `src/app/admin/reviews/page.tsx`（review.export / review.sync-feishu / review.clear-reviewer）
- Modify: `src/app/admin/review/page.tsx`（resource.review 已由页面守卫覆盖，无需改）
- Modify: `src/app/admin/users/page.tsx`（user.reset-password / user.set-roles）
- Modify: `src/app/admin/bitable-field-map/page.tsx`（fieldmap.sync）
- Modify: `src/app/admin/reminders/page.tsx`（reminder.send）
- Modify: `src/app/admin/push/page.tsx`（push.send）
- Modify: `src/app/admin/layouts/competitions-entry-card/page.tsx`（layout.edit）
- Modify: `src/app/admin/feishu-apps/page.tsx`（feishu-app.manage）

- [ ] **Step 1: 课程模块按钮**

在 `src/app/resources/courses/page.tsx`：
- 把 `const { canManageCourses } = useAuth()` 改为 `const { hasPermission } = useAuth()`
- 「同步」按钮条件 `canManageCourses` → `hasPermission('course.sync')`
- 「发布」按钮条件 → `hasPermission('course.publish')`
- 「编辑」按钮条件 → `hasPermission('course.publish')`

在 `src/app/resources/courses/create/page.tsx`：
- `canManageCourses` → `hasPermission('course.publish')`

- [ ] **Step 2: 场景大全导出按钮**

在 `src/app/wish-pool/page.tsx`：
- 找到导出图片按钮（约第 579 行），条件从 `isAdmin` → `hasPermission('wishpool.export-image')`
- 该页用 `isAdmin` 做页面守卫的地方（约第 457/540 行）改用 `hasPermission('nav.wish-pool')`——不，wish-pool 是前台页面所有人可进，守卫应去掉。**只改导出按钮**，页面本身的 `isAdmin` 守卫如果存在要审慎：盘点显示 wish-pool 用 `isAdmin` 做的是"导出图片按钮可见性"而非页面守卫，确认后只改按钮。

- [ ] **Step 3: 大赛/看板按钮**

在 `src/app/competitions/page.tsx`：
- 「立即提报」按钮（约第 468 行）`isAdmin` → `hasPermission('competition.sync')`（提报走飞书表单，与同步同权限）
- ChoDashboard Tab 包裹（约第 646 行）`isAdmin` → `hasPermission('competition.sync') || hasPermission('dashboard.export-image')`

在 `src/components/ChoDashboard.tsx`：
- 「同步」按钮（约第 731 行）→ `hasPermission('competition.sync')`
- 「导出图片」按钮（约第 739 行）→ `hasPermission('dashboard.export-image')`

在 `src/components/CompetitionCard.tsx`：
- 评审打分相关渲染（约第 423 行）`isReviewer` → `hasPermission('review.score')`

- [ ] **Step 4: admin 各页内的操作按钮**

在 `src/app/admin/reviews/page.tsx`：
- 导出 CSV（约第 610 行）→ `hasPermission('review.export')`
- 同步飞书（约第 617 行）→ `hasPermission('review.sync-feishu')`
- 清空评委（约第 415 行）→ `hasPermission('review.clear-reviewer')`

在 `src/app/admin/users/page.tsx`：
- 重置密码按钮（约第 362 行）→ `hasPermission('user.reset-password')`
- 角色修改 Select（约第 278 行）的 disabled 逻辑保留，但能否操作用 `hasPermission('user.set-roles')`

在 `src/app/admin/bitable-field-map/page.tsx`：同步按钮 → `hasPermission('fieldmap.sync')`
在 `src/app/admin/reminders/page.tsx`：发送按钮 → `hasPermission('reminder.send')`
在 `src/app/admin/push/page.tsx`：推送按钮 → `hasPermission('push.send')`
在 `src/app/admin/layouts/competitions-entry-card/page.tsx`：保存按钮 → `hasPermission('layout.edit')`
在 `src/app/admin/feishu-apps/page.tsx`：增删改操作 → `hasPermission('feishu-app.manage')`

- [ ] **Step 5: 编译验证**

Run: `npx tsc --noEmit`
Expected: 无报错

- [ ] **Step 6: 浏览器验证 admin 可见所有按钮**

admin 账号登录，访问各页面，确认同步/发布/导出/打分等按钮都正常显示。

- [ ] **Step 7: 提交**

```bash
git add src/app/resources/ src/app/wish-pool/ src/app/competitions/ src/components/ src/app/admin/
git commit -m "feat: ~20 处关键按钮条件渲染改用 hasPermission"
```

---

## Task 11: /admin/users 角色选择动态化

**Files:**
- Modify: `src/app/admin/users/page.tsx`
- Modify: `src/app/api/admin/users/route.ts`

- [ ] **Step 1: API 的 PATCH 同步写 user_roles**

在 `src/app/api/admin/users/route.ts` 的 PATCH handler 里（处理 roles 修改的部分），除了写 `users.roles`，还要同步写 `user_roles` 表。

先读完整 PATCH handler 确认变量名（`userId`、`admin`/`currentUser`、`data.user.roles` 等以实际代码为准）。在 `update({ roles })` 成功返回后，紧接着加：

```ts
// 同步 user_roles 表（双向保活）
const newRoles: string[] = data.user.roles ?? [];

// 先查 roles 表里实际存在的 key，过滤掉非法值（防 FK 报错）
const { data: existingRoles } = await getSupabaseAdmin()
  .from('roles').select('key');
const validKeys = new Set((existingRoles ?? []).map((r: { key: string }) => r.key));
const validRoleKeys = newRoles.filter((r) => validKeys.has(r));

// 先删该用户所有 user_roles
await getSupabaseAdmin().from('user_roles').delete().eq('user_id', userId);

// 再插新的
if (validRoleKeys.length > 0) {
  await getSupabaseAdmin()
    .from('user_roles')
    .insert(validRoleKeys.map((rk) => ({
      user_id: userId,
      role_key: rk,
      granted_by: admin.id, // 用本 handler 里已鉴权的当前 admin 用户 id（变量名以实际为准）
    })));
}
```

注意：`admin.id` 是本 route 顶部 `requireAdmin` 返回的当前操作者 id，若该 handler 里变量名不同（如 `currentUser`），改成对应名字。

- [ ] **Step 2: 前端 roleOptions 动态读取**

在 `src/app/admin/users/page.tsx`：

删除顶部硬编码的 `roleOptions`（第 11-15 行），改为 state：

```tsx
const [roleOptions, setRoleOptions] = useState<{ value: string; label: string }[]>([
  { value: 'user', label: '普通用户' }, // 初始默认
]);
```

在 `useEffect` 里（fetchUsers 旁边）加：

```tsx
useEffect(() => {
  if (hasPermission('admin.users')) {
    fetch('/api/admin/roles')
      .then((r) => r.json())
      .then((data) => {
        setRoleOptions(
          data.roles.map((r: { key: string; label: string }) => ({
            value: r.key,
            label: r.label,
          }))
        );
      })
      .catch(() => {});
  }
}, [hasPermission]);
```

注意：守卫已经改成 `hasPermission('admin.users')`（Task 9 做的），这里复用。

- [ ] **Step 3: 编译验证**

Run: `npx tsc --noEmit`

- [ ] **Step 4: 浏览器验证**

admin 登录访问 `/admin/users`：
- 系统角色列下拉选项应为 admin / user（来自 DB）
- 修改某用户角色为 admin → 刷新 → 该用户进 `/admin/settings` 应能访问
- 修改某用户角色为 user → 该用户应被重定向

- [ ] **Step 5: 提交**

```bash
git add src/app/admin/users/page.tsx src/app/api/admin/users/route.ts
git commit -m "feat: /admin/users 角色选择从 /api/admin/roles 动态读取 + PATCH 同步 user_roles"
```

---

## Task 12: 新增 /admin/roles 管理页

**Files:**
- Create: `src/app/admin/roles/page.tsx`

- [ ] **Step 1: 写角色管理页**

创建 `src/app/admin/roles/page.tsx`：

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Spin, App, Tabs, Table, Button, Modal, Input, Space, Tag, Checkbox, Typography, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import { getPermissionsByGroup, type PermissionDef } from '@/lib/permissions/registry';
import type { RoleWithStats } from '@/types';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

export default function AdminRolesPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { hasPermission, loading: authLoading } = useAuth();
  const canView = hasPermission('admin.roles');

  const [roles, setRoles] = useState<RoleWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list');
  const [editingRoleKey, setEditingRoleKey] = useState<string | null>(null);

  // 新建角色弹窗
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ key: '', label: '', description: '' });
  const [creating, setCreating] = useState(false);

  // 权限矩阵临时状态：roleKey -> Set<permissionKey>
  const [matrixDraft, setMatrixDraft] = useState<Record<string, Set<string>>>({});
  const [savingMatrix, setSavingMatrix] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/roles');
      if (!res.ok) throw new Error('获取失败');
      const data = await res.json();
      setRoles(data.roles);
      // 初始化矩阵草稿
      const draft: Record<string, Set<string>> = {};
      for (const r of data.roles) {
        if (r.key !== 'admin') draft[r.key] = new Set(r.permissions);
      }
      setMatrixDraft(draft);
    } catch {
      message.error('获取角色列表失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    if (!authLoading && !canView) router.replace('/');
  }, [authLoading, canView, router]);

  useEffect(() => {
    if (canView) fetchRoles();
  }, [canView, fetchRoles]);

  const handleCreate = async () => {
    if (!createForm.key || !createForm.label) {
      message.warning('key 和 label 必填');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '创建失败');
      message.success('角色创建成功');
      setCreateModalOpen(false);
      setCreateForm({ key: '', label: '', description: '' });
      fetchRoles();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (key: string) => {
    try {
      const res = await fetch(`/api/admin/roles/${key}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '删除失败');
      message.success('角色已删除');
      fetchRoles();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  // 矩阵勾选
  const togglePermission = (roleKey: string, permKey: string) => {
    setMatrixDraft((prev) => {
      const next = { ...prev };
      const set = new Set(next[roleKey]);
      if (set.has(permKey)) set.delete(permKey);
      else set.add(permKey);
      next[roleKey] = set;
      return next;
    });
  };

  const handleSaveMatrix = async () => {
    setSavingMatrix(true);
    try {
      // 逐个角色 PUT（角色数量少，串行可接受）
      for (const [roleKey, permSet] of Object.entries(matrixDraft)) {
        const res = await fetch(`/api/admin/roles/${roleKey}/permissions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissionKeys: [...permSet] }),
        });
        if (!res.ok) throw new Error(`保存 ${roleKey} 失败`);
      }
      message.success('权限矩阵已保存，用户下次刷新后生效');
      fetchRoles();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSavingMatrix(false);
    }
  };

  if (authLoading || !canView) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  // ===== Tab 1: 角色列表 =====
  const roleColumns: ColumnsType<RoleWithStats> = [
    { title: '角色 key', dataIndex: 'key', key: 'key', width: 150, render: (v: string) => <code>{v}</code> },
    { title: '名称', dataIndex: 'label', key: 'label', width: 140 },
    { title: '描述', dataIndex: 'description', key: 'description', render: (v: string) => v || '-' },
    { title: '权限点', dataIndex: 'permission_count', key: 'perm_count', width: 90, align: 'center' },
    { title: '用户数', dataIndex: 'user_count', key: 'user_count', width: 90, align: 'center' },
    {
      title: '类型', dataIndex: 'is_system', key: 'is_system', width: 80,
      render: (v: boolean) => v ? <Tag color="blue">系统</Tag> : <Tag>自定义</Tag>,
    },
    {
      title: '操作', key: 'action', width: 180,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => { setEditingRoleKey(record.key); setActiveTab('matrix'); }}
          >
            编辑权限
          </Button>
          {!record.is_system && (
            <Popconfirm title="确认删除该角色？" onConfirm={() => handleDelete(record.key)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // ===== Tab 2: 权限矩阵 =====
  const grouped = getPermissionsByGroup();
  const editableRoles = roles.filter((r) => r.key !== 'admin'); // admin 列固定全勾

  const renderMatrix = () => {
    if (loading) return <Spin />;
    return (
      <div>
        <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(26, 58, 138, 0.04)', border: '1px solid rgba(26, 58, 138, 0.1)' }}>
          <Text type="secondary">
            admin 角色默认拥有全部权限（无需配置）。勾选变更后点击「保存」生效，用户下次刷新页面后看到新权限。
          </Text>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 600 + editableRoles.length * 120 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)', width: 320 }}>权限点</th>
                {editableRoles.map((r) => (
                  <th key={r.key} style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)', minWidth: 120 }}>
                    {r.label}<br/>
                    <Text type="secondary" style={{ fontSize: 11 }}>{r.key}</Text>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([group, perms]) => (
                <PermGroupRows
                  key={group}
                  group={group}
                  perms={perms}
                  roles={editableRoles}
                  matrixDraft={matrixDraft}
                  onToggle={togglePermission}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <Button type="primary" icon={<SaveOutlined />} loading={savingMatrix} onClick={handleSaveMatrix}>
            保存权限矩阵
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <h1 className="text-xl font-bold mb-1">角色与权限</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          管理自定义角色，并通过权限矩阵配置每个角色可见的页面和按钮
        </p>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'list',
              label: '角色列表',
              children: (
                <>
                  <div className="mb-4">
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
                      新建角色
                    </Button>
                  </div>
                  <Table
                    columns={roleColumns}
                    dataSource={roles}
                    rowKey="key"
                    loading={loading}
                    pagination={false}
                  />
                </>
              ),
            },
            {
              key: 'matrix',
              label: '权限矩阵',
              children: renderMatrix(),
            },
          ]}
        />
      </div>

      <Modal
        title="新建角色"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => setCreateModalOpen(false)}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
      >
        <div className="mt-4 space-y-4">
          <div>
            <Text strong>角色 key（英文）</Text>
            <Input
              placeholder="如 content_ops"
              value={createForm.key}
              onChange={(e) => setCreateForm((f) => ({ ...f, key: e.target.value }))}
              className="mt-1"
            />
            <Text type="secondary" style={{ fontSize: 12 }}>小写字母、数字、下划线，以字母开头</Text>
          </div>
          <div>
            <Text strong>显示名称（中文）</Text>
            <Input
              placeholder="如 内容运营"
              value={createForm.label}
              onChange={(e) => setCreateForm((f) => ({ ...f, label: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <Text strong>描述（选填）</Text>
            <Input.TextArea
              placeholder="该角色的职责说明"
              value={createForm.description}
              onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-1"
              rows={2}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** 权限矩阵中一个分组的若干行 */
function PermGroupRows({
  group,
  perms,
  roles,
  matrixDraft,
  onToggle,
}: {
  group: string;
  perms: PermissionDef[];
  roles: RoleWithStats[];
  matrixDraft: Record<string, Set<string>>;
  onToggle: (roleKey: string, permKey: string) => void;
}) {
  return (
    <>
      <tr>
        <td colSpan={roles.length + 1} style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.02)', fontWeight: 600, fontSize: 13 }}>
          {group}
        </td>
      </tr>
      {perms.map((p) => (
        <tr key={p.key}>
          <td style={{ padding: '6px 12px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <div>{p.label}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>{p.key}</Text>
          </td>
          {roles.map((r) => {
            const checked = matrixDraft[r.key]?.has(p.key) ?? false;
            return (
              <td key={r.key} style={{ textAlign: 'center', padding: '6px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <Checkbox checked={checked} onChange={() => onToggle(r.key, p.key)} />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
```

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 无报错

- [ ] **Step 3: 浏览器验证完整流程**

admin 登录访问 `/admin/roles`：
1. Tab1 角色列表：看到 admin（系统）+ user（系统），无「删除」按钮（is_system）
2. 点「新建角色」→ 填 key=`content_ops`、label=`内容运营` → 创建成功，列表多一行
3. 切到 Tab2 权限矩阵：看到 admin 列不显示（固定全勾），user 列和 content_ops 列可勾选
4. 在 content_ops 列勾「内容审核」+「标精选」→ 点「保存权限矩阵」→ 成功
5. 回 Tab1，content_ops 的「权限点」数应为 2
6. 去 `/admin/users`，给某测试用户分配 content_ops 角色
7. 该测试用户登录，确认能看到「内容审核」菜单和「标精选」按钮，但看不到「用户管理」等

- [ ] **Step 4: 提交**

```bash
git add src/app/admin/roles/page.tsx
git commit -m "feat: /admin/roles 角色管理页——角色列表 + 权限矩阵 + 新建/删除"
```

---

## Task 13: 安全修复——3 个 API 补 requireAdmin

**Files:**
- Modify: `src/app/api/competitions/sync/route.ts`
- Modify: `src/app/api/wish-pool/sync-field-map/route.ts`
- Modify: `src/app/api/admin/reviews/sync-progress/route.ts`

- [ ] **Step 1: competitions/sync 补权限校验**

读 `src/app/api/competitions/sync/route.ts`，找到 POST handler 开头（约第 268-278 行，现在只校验登录）。

在获取 userId 后、执行同步逻辑前，加 admin 校验：

```ts
// 已有：
const userId = request.cookies.get('feishu_user_id')?.value;
if (!userId) { return NextResponse.json({ error: '未登录' }, { status: 401 }); }

// 新增（在原有逻辑前）：
const { data: currentUser } = await getSupabaseAdmin()
  .from('users').select('roles').eq('id', userId).single();
if (!currentUser?.roles?.includes('admin')) {
  return NextResponse.json({ error: '仅管理员可同步' }, { status: 403 });
}
```

- [ ] **Step 2: wish-pool/sync-field-map 补权限校验**

读 `src/app/api/wish-pool/sync-field-map/route.ts`（约第 15 行，当前完全无校验）。

在 handler 最开头加：

```ts
const userId = request.cookies.get('feishu_user_id')?.value;
if (!userId) { return NextResponse.json({ error: '未登录' }, { status: 401 }); }
const { data: currentUser } = await getSupabaseAdmin()
  .from('users').select('roles').eq('id', userId).single();
if (!currentUser?.roles?.includes('admin')) {
  return NextResponse.json({ error: '仅管理员可同步' }, { status: 403 });
}
```

- [ ] **Step 3: admin/reviews/sync-progress 补权限校验**

读 `src/app/api/admin/reviews/sync-progress/route.ts`（约第 82 行，当前无校验）。

同样在 handler 开头加上述 admin 校验代码。

- [ ] **Step 4: curl 验证权限拦截**

```bash
# 未登录访问应 401
curl -s -X POST http://localhost:3000/api/wish-pool/sync-field-map -o /dev/null -w "%{http_code}"
# 预期：401

# 普通用户访问应 403
curl -s -X POST http://localhost:3000/api/wish-pool/sync-field-map \
  -H "Cookie: feishu_user_id=<NORMAL_USER_ID>" -o /dev/null -w "%{http_code}"
# 预期：403
```

- [ ] **Step 5: 提交**

```bash
git add src/app/api/competitions/sync/route.ts src/app/api/wish-pool/sync-field-map/route.ts src/app/api/admin/reviews/sync-progress/route.ts
git commit -m "fix: 3 个 API 补 requireAdmin 权限校验（安全修复）"
```

---

## Task 14: 全站集成自检

**Files:** 无（纯验证）

- [ ] **Step 1: TypeScript 全量编译**

Run: `npx tsc --noEmit`
Expected: 无报错

- [ ] **Step 2: ESLint**

Run: `npm run lint`
Expected: 无 error（warning 可接受）

- [ ] **Step 3: curl 验证 /api/auth/me 各角色**

```bash
# admin
curl -s http://localhost:3000/api/auth/me -H "Cookie: feishu_user_id=<ADMIN_ID>" | python3 -c "import sys,json; d=json.load(sys.stdin); u=d.get('user',{}); print('admin:', len(u.get('permissions',[])), 'perms; isAdmin roles:', 'admin' in (u.get('roles') or []))"
# 预期：admin: 35 perms; isAdmin roles: True

# 普通用户（迁移后清零为 user）
curl -s http://localhost:3000/api/auth/me -H "Cookie: feishu_user_id=<NORMAL_ID>" | python3 -c "import sys,json; d=json.load(sys.stdin); u=d.get('user',{}); print('user:', len(u.get('permissions',[])), 'perms; roles:', u.get('roles'))"
# 预期：user: 0 perms; roles: ['user']
```

- [ ] **Step 4: 浏览器走查 admin 全流程**

admin 登录：
- [ ] 导航「管理后台」展开有 11 项（含「角色与权限」）
- [ ] /admin/roles 可新建/删除自定义角色、配置权限矩阵、保存
- [ ] /admin/users 角色下拉选项动态来自 DB
- [ ] 各 admin 页面正常显示，所有操作按钮可见

- [ ] **Step 5: 浏览器走查自定义角色全流程**

- [ ] 在 /admin/roles 新建角色 `course_editor`，勾选 `course.sync` + `course.publish` + `nav.resources`
- [ ] 在 /admin/users 给测试用户分配 `course_editor`
- [ ] 测试用户登录，确认：
  - 导航只看到首页/场景大全/AI大赛/课程资源（resources 因勾选可见，其他 nav 默认全角色可见）
  - /resources/courses 页面「同步」「发布」按钮可见
  - 「管理后台」入口不可见（无 admin.* 权限点）
  - 直接访问 /admin/settings 被重定向首页

- [ ] **Step 6: 提交最终状态**

```bash
git add -A
git status  # 确认无遗漏
# 如有遗漏的改动一起提交
git commit -m "chore: RBAC 权限体系集成自检通过" --allow-empty
```

---

## 完成标准

全部 Task 1-14 完成后：
1. DB 有 roles / role_permissions / user_roles 三表，seed 了 admin + user
2. /api/auth/me 返回 permissions 字段
3. admin 可在 /admin/roles 自定义角色、配置权限矩阵
4. /admin/users 可给用户分配角色（动态选项）
5. 全站导航/页面守卫/按钮条件基于 hasPermission
6. 3 个安全洞已补 requireAdmin
7. 现有 admin 账号权限不受影响，现有普通用户清零为 user（待管理员重新分配）
