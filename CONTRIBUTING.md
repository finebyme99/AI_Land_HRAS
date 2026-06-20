# HRAS AI Land 开发规范

## 项目概述

HRAS AI Land 是 HR AI 社区平台，基于 Next.js 16 + Supabase + 飞书 OAuth。

## 分支策略

当前阶段（2026-06）直接在 **main** 分支开发和提交。

### 开发工作流

```bash
cd /Users/zt26278/Q/AI/26AI落地/AILand
# 直接在 main 上开发
git add -A && git commit -m "xxx" && git push origin main
# Vercel GitHub webhook 未连接，需手动部署：
npx vercel deploy --prod --yes
```

## 技术架构约束

### 必须遵守

- **Next.js 16**：使用 `use(params)` 解析动态路由参数，不要用 `params.id` 直接访问
- **React 19**：支持 Server Components，但当前项目全部使用 `'use client'`
- **TypeScript**：严格模式，不允许 any，所有类型定义在 `src/types/index.ts`
- **Ant Design 6**：使用 `App.useApp()` 获取 message/notification，不要用静态方法
- **Supabase**：通过 `getSupabase()` 获取客户端，不要直接 new SupabaseClient

### 样式规范

- **Glassmorphism 风格**：所有卡片使用 `glass` 类 + `rgba(255,255,255,0.6)` 边框
- **CSS 变量**：使用 `var(--primary)`, `var(--text-secondary)` 等，不要硬编码颜色
- **字体**：Outfit（英文标题）+ Noto Sans SC（中文正文）
- **主色**：`#1a3a8a`（深蓝）、`#F27F22`（暖橙）
- **页面边距**：全站统一 `px-[100px]` 左右边距，直接改父容器，不要在子组件用 `width:100vw` + 负 `margin` hack

### 飞书枚举规范（强制）

- **禁止硬编码飞书多维表格选项值**（场景分类、落地进展、大赛进展等）。所有选项值从 `bitable_field_map.options`(DB) 动态读取，通过 `fieldOptions` 传递给前端
- **颜色分配**用位置序号+固定色板算法（`lib/bitable/enums.ts` 的 `buildColorMap` / `paletteColor`），飞书新增选项自动获得下一个色板颜色，无需手动维护颜色映射
- **落地进展分组**用 `isLandedState(name)`（`name.includes('上线')`）动态判断，不硬编码已落地/待实现列表
- **筛选枚举构建**统一用 `fieldOptionsToFilterItems`（`lib/bitable/filter-options.ts`），优先 DB options，fallback 数据聚合，count=0 不显示
- 例外：`SORT_OPTIONS`（排序维度）、`PERIOD_OPTIONS`（评审周期）是前端 UI 逻辑不涉及飞书选项，可各自定义
- **"数据补充中"永久排除**：落地进展和大赛进展的"数据补充中"选项从 fieldOptions 和记录数据双重排除（API 层 `.neq`/filter + `fieldOptions.filter`），前端永远不展示此枚举值

### 字段命名一致性（强制）

- **同一数据源 = 同一显示标签**：如果多个页面/视图引用同一个飞书字段（同一个 `dataIndex`），用户可见的列标题必须完全一致。例如 `dataIndex: 'title'` 在所有表格中统一显示为"名称"，不能一个叫"标题"另一个叫"名称"
- **同一语义 = 同一字段名**：同一个业务概念（如"月均提效节省工时"）在不同页面应该使用相同的 `dataIndex` 和相同的显示标签，不能出现 ChoDashboard 用 `savedHours` / "月节省工时" 而 wish-pool 用 `monthlySavedHours` / "提效工时" 的分歧
- **差异允许**：不同页面因业务视角不同需要展示不同字段（如 ChoDashboard 有"降本折算工时"而 wish-pool 没有），这是允许的。但只要出现了，标签必须对齐飞书字段注释（`fieldDescriptions`）
- **新增字段时**：先查 `lib/bitable/field-map-reader.ts` 的映射表确认已有 key，复用已有 key 和标签，不要自己起新名字

### 文件结构

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 首页（居中Hero+5项glass指标带）
│   ├── wish-pool/         # 场景大全（三Tab视图：总览/已落地/待实现）
│   │   └── page.tsx
│   ├── resources/         # 课程资源（课程+工具 Tab页）
│   │   ├── page.tsx
│   │   ├── courses/       # 公开课子页
│   │   └── apps/          # 工具推荐子页
│   ├── competitions/      # AI 大赛
│   │   ├── page.tsx       # 大赛首页
│   │   └── [id]/          # 方案详情页
│   ├── admin/             # 管理后台
│   │   ├── review/        # 内容审核
│   │   ├── users/         # 用户管理
│   │   ├── reviews/       # 评审管理
│   │   ├── reviews-overview/  # 旧版评审看板（未删）
│   │   ├── push/          # 飞书推送
│   │   ├── reminders/     # 提醒管理
│   │   ├── feishu-apps/   # 飞书多租户应用配置
│   │   ├── bitable-field-map/  # 飞书多维表格字段映射管理
│   │   ├── layouts/       # 页面布局配置
│   │   └── settings/      # 平台设置
│   ├── profile/           # 个人中心（书签/贡献/通知/设置子页）
│   ├── login/             # 登录（多企业飞书按钮）
│   └── api/               # API 路由
│       ├── dashboard-summary/  # 首页指标卡聚合
│       ├── wish-pool/          # 场景池数据 API
│       ├── competitions/      # AI大赛
│       │   ├── sync/          # 飞书→Supabase 同步（含 field-map 同步副作用）
│       │   ├── progress/      # 赛事进展数据
│       │   └── reviews/       # 评审评分 + CSV导出
│       ├── courses/           # 课程管理
│       │   └── sync/          # 课程飞书同步
│       ├── resources/         # 工具推荐 API
│       ├── apps/              # 工具 API（含 logo 上传）
│       ├── auth/              # 认证
│       │   ├── feishu/ + callback/  # 飞书 OAuth
│       │   ├── login|register|logout|me/  # 用户名密码兜底
│       │   └── email/         # 魔法链接（未启用）
│       ├── feishu-apps/       # 飞书多企业配置
│       │   └── public/        # 公开列表
│       ├── feishu/            # 飞书通用（card-callback）
│       ├── admin/
│       │   ├── competitions/overview/  # 成效看板聚合（含 fieldDescriptions+fieldOptions）
│       │   ├── bitable-field-map/      # 字段映射 CRUD + sync-from-feishu
│       │   ├── reviews/               # 评审清理/同步
│       │   ├── push/                  # 推送日志+飞书聊天
│       │   ├── reminders/             # 提醒 CRUD+发送
│       │   ├── settings/              # 平台设置
│       │   └── users/                 # 用户管理
│       ├── cron/              # Vercel cron
│       │   ├── sync-courses/        # 课程同步
│       │   ├── feishu-apps-health/  # 飞书连通性
│       │   └── weekly-course-card/  # 课程周卡
│       ├── interactions/      # 点赞/收藏
│       ├── comments/ + topics/ + answers/ + bookmarks/  # 社区互动
│       ├── layouts/           # 页面布局配置
│       ├── user/ + users/list/ # 用户信息
│       └── debug/             # 调试工具
├── components/            # 公共组件
│   ├── Navigation.tsx     # 导航栏（4项：首页/场景大全/AI大赛/课程资源）
│   ├── ChoDashboard.tsx   # 成效看板（筛选+导出+指标卡+公式）
│   ├── DetailListBlock.tsx # 共享明细列表（WishItem类型+fmt系列+FilterRow+表格），wish-pool/competitions共用
│   ├── HighlightSweep.tsx # 标题 shimmer 动效
│   ├── SearchInput.tsx    # 搜索输入框
│   └── EntryCard/         # 大赛参赛卡片
├── lib/                   # 工具库
│   ├── auth-context.tsx   # 认证上下文
│   ├── supabase.ts / supabase-browser.ts / supabase-server.ts / supabase-admin.ts
│   ├── constants.ts       # 常量枚举
│   ├── feishu.ts          # 飞书 API + 多租户 token
│   ├── feishu-app-store.ts / feishu-message.ts / feishu-card.ts / feishu-cards.ts / feishu-card-templates.ts
│   ├── bitable/           # 飞书多维表格字段映射
│   │   ├── field-map.ts           # FALLBACK_FIELD_MAP + 类型定义（含 FieldSelectOption）
│   │   ├── field-map-reader.ts    # getActiveFieldMap()（DB优先+fallback，5min缓存）
│   │   ├── sync-field-map.ts      # syncFieldMapFromFeishu() 共享同步函数
│   │   ├── filter-options.ts      # 篮选枚举构建（fieldOptionsToFilterItems + aggregateOptions）
│   │   ├── enums.ts               # 动态枚举（色板分配+isLandedState+reuseLevelStyle）
│   │   └── page-usage.ts          # 字段使用页面枚举
│   └── db/               # 数据库访问层
└── types/
    └── index.ts           # 类型定义（含 FeishuApp / AuthLog / User / FieldSelectOption）
```

### 权限控制

- `useAuth()` 提供 `{ user, isAdmin, isReviewer, isCourseAdmin, canManageCourses, loading, signOut, refreshUser }`
- `isAdmin` 由 `user?.roles` 数组包含 `'admin'` 或 `'moderator'` 决定
- `isReviewer` = `isAdmin` ∪ `roles.includes('reviewer')`（reviewer 角色由 `competitions/sync` 同步时回填）
- `isCourseAdmin` = `roles.includes('course_admin')`；`canManageCourses` = `isAdmin` ∪ `isCourseAdmin`
- 角色（DB key → 中文）：`admin` 管理员 / `moderator` 版主 / `reviewer` 评委 / `course_admin` AI 课程管理员 / `contributor` 贡献者 / `user` 普通用户
- admin 操作：审核内容、编辑任意案例/工具/课程、标精选、管理用户
- `course_admin` AI 课程管理员：在 /courses 模块可同步、发布、编辑课程，不能动其他后台
- 普通用户：提交案例（需审核）、提交工具（需审核）、点赞、收藏
- 案例/工具的作者可编辑自己的内容

## 数据库迁移

- 迁移文件放在 `supabase/migrations/` 目录
- 命名规范：`001_xxx.sql`, `002_xxx.sql`, ...
- 执行方式：在 Supabase Dashboard 的 SQL Editor 中运行
- 重要：迁移前备份数据

## 环境变量

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=xxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# 应用 URL
NEXT_PUBLIC_APP_URL=https://hras-ai-land.vercel.app
```

飞书应用凭证存于 `feishu_apps` 表（admin UI 录入），不在环境变量中。`FEISHU_APP_ID` / `FEISHU_APP_SECRET` env 变量仅作为 8 个旧 single-tenant 调用点的 deprecated shim 保留，迁完后可删。

## 部署

- **Vercel**：从 main 分支部署（GitHub webhook **未连接**，push 后需手动 `npx vercel deploy --prod --yes`）
- **生产地址**：https://hras-ai-land.vercel.app
- **飞书回调 URL**：`https://hras-ai-land.vercel.app/api/auth/feishu/callback`

## 协作约定

1. **不要修改其他模块的文件**：除非必要，只改自己负责的模块
2. **公共组件改动需同步**：改 Navigation.tsx、auth-context.tsx 等公共文件后，通知其他分支
3. **类型定义共享**：新类型加到 `src/types/index.ts`，不要在模块内定义私有类型
4. **CSS 变量统一**：新颜色/间距用 CSS 变量，不要硬编码

## 自检规范

**所有改动必须自行验证后再提交，不要依赖用户发现 bug。**

1. **页面类改动**：用 `curl` 验证 HTTP 状态码和关键 HTML 片段
2. **API 类改动**：用 `curl` 调用接口，确认返回值符合预期
3. **静态资源**：确认文件存在且 dev server 能正确 serve（Next.js 不自动 serve 目录下的 index.html，需用完整路径）
4. **导航/路由**：确认按钮链接指向正确，页面切换后无残留元素
5. **数据类改动**：确认数据库迁移文件、API 路由、前端消费端三者字段一致
