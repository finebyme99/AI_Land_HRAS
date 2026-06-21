# AI岛 权限管理体系（RBAC）设计

**日期**：2026-06-21
**状态**：待批准

## 背景

当前权限判断**全部硬编码、分散在三处**：

1. `src/lib/auth-context.tsx:55-60` —— 派生出 `isAdmin` / `isReviewer` / `isCourseAdmin` / `canManageCourses` 四个布尔值
2. `src/components/Navigation.tsx` —— 导航项、管理后台菜单用 `isAdmin`/`isReviewer`/`isCourseAdmin` 做条件渲染（Desktop + Mobile 两份对称代码）
3. 各 admin 页面顶部 —— 重复 `if (!isAdmin) return null` 守卫

**痛点**：每新增一个模块或按钮，都要同时改 `auth-context.tsx`（加一个 `isXxx` 派生值）、改 `Navigation.tsx`（加一个条件分支）、改 `admin/users` 页面（加一个角色选项），三处耦合，且管理员**无法在运行时配置**角色能看什么、不能看什么。

此外，盘点中发现 **3 个后端 API 缺少权限校验**的安全洞（详见末尾"安全修复"），应在本期一并补齐。

## 目标

做一套**轻量 RBAC**，达成：

1. **角色可自定义**：管理员可在后台新建角色（如"内容运营""财务审核"），不必改代码
2. **权限可配置**：管理员通过权限矩阵勾选「角色 × 权限点」，保存即生效
3. **粒度 = 页面 + 关键操作按钮**：粒度介于"整模块"和"通用 resource:action"之间
4. **权限点清单代码内声明**：参考现有 `bitable_field_map` 模式，避免代码与 DB 脱节
5. **平滑迁移**：现有 `users.roles` 字段保留作 fallback，`isAdmin` 等老派生值保留语义
6. **为权限申请/审批留扩展位**：本期不实现，但数据模型已留好钩子

## 非目标（本期不做）

- 权限申请 → 审批 → 自动开通 的完整流程（仅预留表结构）
- API 鉴权中间件化（route handler 统一装饰器）
- 操作日志审计
- 数据级权限（行级 / 列级过滤）
- 合并 `reviewer_roles` 到新模型（它是「评分维度授权」，与「可见性」正交，保持独立）

## 数据模型

新增迁移文件 `supabase/migrations/057_rbac.sql`，3 张新表：

### 1. `roles` —— 角色定义

```sql
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,                -- 'admin'/'moderator'/'course_admin'/'reviewer'/'contributor'/'user' + 自定义
  label text NOT NULL,                     -- 中文显示名
  description text,
  is_system boolean NOT NULL DEFAULT false,-- true = 内置角色，不可删除（label/description 可改）
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Seed（系统内置 2 个角色）**：

| key | label | is_system | 说明 |
|---|---|---|---|
| `admin` | 管理员 | true | 拥有全部权限点，权限矩阵中不可取消勾选 |
| `user` | 普通用户 | true | 默认角色 |

> **不预制 moderator/course_admin/reviewer/contributor**。管理员后续在 `/admin/roles` 自行创建自定义角色并分配。现有用户 `users.roles` 里的这些 key 在迁移时清零为 `user`（详见 `user_roles` 表说明）。

`admin` 在权限解析层特殊处理：**永远拥有所有权限点**，不受 `role_permissions` 表约束。

### 2. `role_permissions` —— 角色 × 权限点

```sql
CREATE TABLE role_permissions (
  role_key text NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
  permission_key text NOT NULL,            -- 引用代码内 PERMISSIONS 注册表的 key
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_key, permission_key)
);
```

**约束说明**：
- `permission_key` 不加 FK：代码删除某权限点后，DB 残留的孤儿记录在 API 读取时用 `Set` 过滤掉，不报错（参考 `bitable_field_map` 的处理哲学）
- `admin` 角色的记录不写入此表，解析时直接返回全集

**Seed（默认分配）**：因为只 seed `admin` + `user`，且 `user` 不预分配任何权限点，所以 `role_permissions` 表初始为空。`admin` 不写入（解析时返回全集）。所有细分权限由管理员后续在 `/admin/roles` 配置。

### 3. `user_roles` —— 用户 × 角色（多对多）

```sql
CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_key text NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
  granted_by uuid REFERENCES users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_key)
);
```

**与现有 `users.roles` 的关系**：
- 迁移时执行：现有用户 `users.roles` 里的 `moderator`/`course_admin`/`reviewer`/`contributor`/`user` 全部**清零映射为 `user`**，只有 `admin` 保留为 `admin`。即：
  ```sql
  INSERT INTO user_roles(user_id, role_key)
  SELECT id,
         CASE WHEN 'admin' = ANY(roles) THEN 'admin' ELSE 'user' END
  FROM users
  WHERE roles IS NOT NULL AND array_length(roles, 1) > 0;
  ```
- **迁移代价（用户已知悉并接受）**：现有 moderator/course_admin/reviewer 用户会**暂时失去原有管理权限**，需要管理员后续在 `/admin/roles` 创建对应自定义角色后，再到 `/admin/users` 重新分配。
- `users.roles` 字段**保留 1-2 个版本**作为 fallback：`/api/auth/me` 优先读 `user_roles`，空则回退到 `users.roles`
- `admin/users` 页面后续改写 `user_roles`，同时同步写回 `users.roles`（双向保活，过渡期保险）
- 2 个版本后再考虑彻底废弃 `users.roles`

### 预留（本期不创建，记在此处供未来实现）

```sql
-- 未来：权限申请审批
CREATE TABLE permission_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  role_key text NOT NULL REFERENCES roles(key),
  reason text,
  status text NOT NULL DEFAULT 'pending',   -- pending/approved/rejected
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

未来在 `/profile` 加「申请权限」入口 → 填理由 → 管理员在 `/admin/roles` 看到待审批 → 通过则写入 `user_roles`。**权限解析层完全不用改**。

## 权限点注册表

新建 `src/lib/permissions/registry.ts`，权限点定义在代码内，每个模块 import 自己的部分。

```ts
export interface PermissionDef {
  key: string;              // 'admin.users'
  label: string;            // '用户管理页'
  group: string;            // '管理后台'（用于矩阵分组显示）
  description?: string;
}

export const PERMISSIONS: PermissionDef[] = [ /* 见下方完整清单 */ ];
export const PERMISSION_KEYS = new Set(PERMISSIONS.map(p => p.key));
export function getPermissionsByGroup(): Record<string, PermissionDef[]> { /* ... */ }
```

### 完整权限点清单（共 ~30 个，按盘点结果整理）

> **命名规范**：`<模块>.<对象/动作>`，避免再分 nav/admin/page 三套（盘点发现这三者经常重合）。

#### 前台导航（4 个，默认全角色可见，矩阵中可关闭）

| key | label | group |
|---|---|---|
| `nav.home` | 首页 | 前台导航 |
| `nav.wish-pool` | 场景大全 | 前台导航 |
| `nav.competitions` | AI大赛 | 前台导航 |
| `nav.resources` | 课程资源 | 前台导航 |

#### 管理后台页面（10 个）

> 每个 admin 页面对应一个权限点，同时控制「菜单可见」和「页面守卫」两处。

| key | label | group | 现 fallback |
|---|---|---|---|
| `admin.reviews` | 评审管理 | 管理后台 | isReviewer |
| `admin.reviews-overview` | 评审一览 | 管理后台 | isAdmin |
| `admin.review` | 内容审核 | 管理后台 | isAdmin |
| `admin.users` | 用户管理 | 管理后台 | isAdmin |
| `admin.bitable-field-map` | 字段映射配置 | 管理后台 | isAdmin |
| `admin.layouts` | 方案卡片布局 | 管理后台 | isAdmin |
| `admin.reminders` | 提醒管理 | 管理后台 | isAdmin |
| `admin.push` | 飞书推送 | 管理后台 | isAdmin |
| `admin.feishu-apps` | 飞书应用配置 | 管理后台 | isAdmin |
| `admin.settings` | 平台设置 | 管理后台 | isAdmin |

#### 关键操作按钮（按模块）

| key | label | group |
|---|---|---|
| `course.sync` | 课程同步飞书 | 课程模块 |
| `course.publish` | 课程发布/编辑 | 课程模块 |
| `review.score` | 评审打分 | 大赛评审 |
| `review.export` | 评审记录导出 CSV | 大赛评审 |
| `review.sync-feishu` | 评审进度同步飞书 | 大赛评审 |
| `review.clear-reviewer` | 清空评委评分 | 大赛评审 |
| `competition.sync` | 大赛数据同步飞书 | 大赛评审 |
| `case.feature` | 标精选 | 场景池 |
| `case.submit` | 提交案例 | 场景池 |
| `resource.submit` | 提交工具 | 资源 |
| `resource.review` | 内容审核通过/驳回 | 资源 |
| `user.reset-password` | 重置密码 | 用户管理 |
| `user.set-roles` | 修改他人角色 | 用户管理 |
| `fieldmap.sync` | 字段映射同步飞书 | 字段映射 |
| `reminder.send` | 提醒发送 | 提醒 |
| `push.send` | 飞书群推送 | 推送 |
| `layout.edit` | 布局编辑保存 | 布局 |
| `feishu-app.manage` | 飞书应用增删改 | 飞书应用 |
| `settings.save` | 平台设置保存 | 平台设置 |
| `wishpool.export-image` | 场景大全导出图片 | 场景池 |
| `dashboard.export-image` | 效果看板导出图片 | 大赛评审 |

## 权限解析层

新建 `src/lib/permissions/index.ts`（server-side，被 API route 调用）：

```ts
// 聚合用户拥有的所有权限点 key
export async function getUserPermissions(userId: string): Promise<Set<string>> {
  // 1. 查 user_roles → role_keys[]
  // 2. 若含 'admin' → 直接返回 PERMISSION_KEYS 全集（短路）
  // 3. 否则查 role_permissions WHERE role_key IN (...) → permission_keys[]
  // 4. 用 PERMISSION_KEYS 过滤掉代码已删除的孤儿 key
}

// 判断单个权限点
export async function hasPermission(userId: string, key: string): Promise<boolean> {
  const perms = await getUserPermissions(userId);
  return perms.has(key);
}
```

**缓存**：`getUserPermissions` 结果在请求内缓存（`cache()` 或模块级 Map + TTL 60s），避免一次请求里多次查询。

## API 改动

### 1. `/api/auth/me`（修改）

返回里新增 `permissions: string[]`：

```ts
.select('id, ..., roles, reviewer_roles, ...')
// 单独查询：
const permissions = await getUserPermissions(user.id);
return NextResponse.json({ user: { ...user, permissions: [...permissions] } });
```

### 2. `/api/admin/roles`（新增）

| Method | Path | 功能 | 权限 |
|---|---|---|---|
| GET | `/api/admin/roles` | 列出所有角色 + 每个角色的权限点 + 用户数 | `admin` only |
| POST | `/api/admin/roles` | 新建自定义角色 `{ key, label, description }` | `admin` only |
| PATCH | `/api/admin/roles/[key]` | 改 label/description（系统角色 key 不可改） | `admin` only |
| DELETE | `/api/admin/roles/[key]` | 删除自定义角色（系统角色禁删，会先校验 `is_system`） | `admin` only |
| PUT | `/api/admin/roles/[key]/permissions` | 覆盖该角色的权限点清单 `{ permissionKeys: string[] }` | `admin` only |

`admin` 角色的 PUT 请求直接返回 200 但不写库（解析时已短路返回全集）。

### 3. `/api/admin/users`（修改）

- `PATCH` 设置角色：除写 `users.roles`，**同时同步 `user_roles` 表**（双向保活）
- `roleOptions` 改为从 `roles` 表动态读取（前端不再硬编码 `roleOptions`）

## 前端改动

### 1. `src/lib/auth-context.tsx`（修改）

```ts
interface AuthContextType {
  // 既有字段全部保留...
  permissions: Set<string>;              // 新增
  hasPermission: (key: string) => boolean; // 新增
}
```

- `user.permissions`（来自 `/api/auth/me`）初始化为 `Set`
- `hasPermission(key)` = `permissions.has(key)`
- **`isAdmin`/`isReviewer`/`isCourseAdmin`/`canManageCourses` 保留**，但内部重写为基于角色 key 判断（而非基于权限点，避免「自定义角色恰好有某个 admin 权限点」被误判为 admin）：
  - `isAdmin` = `user.roles.includes('admin')`（不再含 moderator，因为 moderator 角色已不预制；如果未来需要 moderator 语义，由管理员建自定义角色并赋予相应权限点，但 `isAdmin` 这个老布尔值只认 `admin`）
  - `isCourseAdmin` = `user.roles.includes('course_admin')`（迁移后现有 course_admin 用户已清零为 user，此值对他们会是 false，直到管理员重新分配）
  - `isReviewer` = `isAdmin || (user.reviewer_roles?.length ?? 0) > 0`（保持现状，reviewer_roles 独立维度，不受 roles 清零影响）
  - `canManageCourses` = `isAdmin || isCourseAdmin`
  - **权限点判断走 `hasPermission()`**，与上述「是否 admin 身份」是两套独立机制：admin 身份用于老代码兼容，权限点用于新功能细粒度控制
  - **迁移后过渡期提醒**：现有 moderator/course_admin 用户的老派生值会暂时为 false。受影响的老代码路径（如 `/resources/courses` 页用 `canManageCourses` 控制同步按钮）会暂时隐藏按钮，待管理员在 `/admin/roles` 建好自定义角色并分配后恢复。新代码应优先用 `hasPermission()`。

### 2. `src/components/Navigation.tsx`（修改）

把硬编码的 `isAdmin ? [...] : []` 改成 `hasPermission('admin.users')` 等。Desktop 和 Mobile 两份对称代码合并为一个 `buildAdminMenu()` 函数，消除当前重复。

### 3. admin 各页面顶部守卫（修改）

把 `if (!isAdmin) return null` 改成 `if (!hasPermission('admin.users')) return null`（每个页面用自己的权限点）。10 个 admin 页面逐一改。

### 4. 关键按钮条件渲染（修改）

把 `canManageCourses &&` / `isAdmin &&` 等条件改成 `hasPermission('course.sync') &&` 等。涉及约 20 处按钮。

### 5. 新增 `/admin/roles` 页面

**路由**：`src/app/admin/roles/page.tsx`（仅 `admin` 角色可进，独立于权限矩阵）

**布局**：两个 Tab

**Tab 1：角色列表**
- 表格列：角色 key / 中文 label / 描述 / 权限点数 / 拥有用户数 / 操作
- 操作：「编辑权限」（切到 Tab 2 并选中）/「删除」（仅非 `is_system`）
- 顶部「新建角色」按钮 → 弹窗填 key（英文 snake_case，不可与现有重复）/ label / description

**Tab 2：权限矩阵**
- 行：权限点（按 `group` 分组，组内有分割线）
- 列：每个非 admin 角色一列（admin 列固定显示全勾且禁用）
- 单元格：Checkbox
- 「保存」按钮一次性 PUT 所有变更的角色权限
- 顶部说明：「admin 角色默认拥有全部权限；勾选变更后点击保存生效，用户下次刷新页面后看到新权限」

**UI 风格**：遵循 Glassmorphism（`glass` 类 + `rgba(255,255,255,0.6)` 边框）、Ant Design 6、`App.useApp()` 取 message。

### 6. `/admin/users` 页面（修改）

- 系统角色 `Select`：`roleOptions` 改为从 `/api/admin/roles` 动态读取（保留颜色映射，自定义角色用默认色）
- 「分配评委角色」相关逻辑**保持不动**（reviewer_roles 是独立维度）

## 安全修复（顺手补齐）

盘点发现 3 个 API 缺少权限校验，本期一并补齐：

| 路由 | 现状 | 修复 |
|---|---|---|
| `POST /api/competitions/sync` | 仅校验登录 | 加 `requireAdmin`（或基于 `competition.sync` 权限点） |
| `POST /api/wish-pool/sync-field-map` | 完全无校验 | 加 `requireAdmin` |
| `POST /api/admin/reviews/sync-progress` | 完全无校验 | 加 `requireAdmin` |

这三处属于现有 bug，独立于 RBAC，但因为正好在权限相关代码路径上，一起补掉。

## 实现顺序

1. **DB 迁移** `057_rbac.sql`（3 表 + seed + 从 `users.roles` 回填 `user_roles`）
2. **权限点注册表** `src/lib/permissions/registry.ts`（含完整清单）
3. **权限解析层** `src/lib/permissions/index.ts`（`getUserPermissions` + `hasPermission` + 请求级缓存）
4. **API**：`/api/auth/me` 加 `permissions`；新增 `/api/admin/roles` 全套
5. **前端核心**：`auth-context.tsx` 加 `permissions` + `hasPermission`，老派生值改写
6. **前端替换**：`Navigation.tsx` + 10 个 admin 页面守卫 + ~20 处按钮条件
7. **新页面**：`/admin/roles` 角色列表 + 权限矩阵
8. **安全修复**：3 个 API 加 `requireAdmin`
9. **自检**：`curl` 验证 `/api/auth/me` 返回 permissions；admin 角色看到全部菜单/按钮、user 角色看不到任何 admin 菜单；新建一个自定义角色「测试版主」勾几个权限点 → 分配给某测试用户 → 刷新页面验证可见性符合矩阵配置

## 验证矩阵

迁移刚完成时（管理员尚未配置自定义角色）：

| 角色 | admin 菜单 | 课程同步 | 评审打分 | 用户管理 | 字段映射 |
|---|---|---|---|---|---|
| `admin` | 全部 | ✅ | ✅ | ✅ | ✅ |
| `user`（含迁移前的 moderator/course_admin/reviewer） | ❌ | ❌ | 仅 reviewer_roles 非空时可打分 | ❌ | ❌ |
| 自定义角色 | 按矩阵配置 | 按矩阵配置 | 按矩阵配置 | 按矩阵配置 | 按矩阵配置 |

> 管理员在 `/admin/roles` 创建并配置好自定义角色（如「课程管理员」「版主」）后，分配给相应用户，他们的 `hasPermission()` 即按矩阵返回 true。

## 取舍说明

- **不合并 `reviewer_roles`**：它是「能评 user/business/tech 哪几个维度」的授权，与「页面可见性」是正交概念，合并会污染数据模型
- **`admin` 角色权限解析短路**：不写 `role_permissions` 表，解析时直接返回全集。避免矩阵 UI 上 admin 列那 30 个勾选框需要单独维护
- **`permission_key` 不加 FK**：参考 `bitable_field_map`，代码删权限点后 DB 残留记录会被 `Set` 过滤，加 FK 反而要写迁移去清理
- **`users.roles` 保留作 fallback**：避免一次性切断所有老代码读取路径，过渡 2 个版本后再废弃
- **`/admin/roles` 仅 admin 可进**：moderator 不能进，防止其给自己提权
- **不做 API 鉴权中间件化**：本期保持现有 `requireAdmin` 函数模式，权限点判断先只落前端 + 关键 API，未来如有需要再抽中间件
