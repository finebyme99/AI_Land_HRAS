# HRAS AI Land 开发规范

## 项目概述

HRAS AI Land 是 HR AI 社区平台，基于 Next.js 16 + Supabase + 飞书 OAuth。

## 分支策略

当前阶段（2026-06）直接在 **main** 分支开发和提交。Vercel 部署源是 main，push 即自动部署。

### 开发工作流

```bash
cd /Users/apple/Q/AI/26AI落地/AILand
# 直接在 main 上开发
git add -A && git commit -m "xxx" && git push origin main
# Vercel 自动部署
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

### 文件结构

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 首页
│   ├── cases/             # 案例库（HRAS案例库）
│   │   ├── page.tsx       # 列表页（含编辑弹窗）
│   │   ├── create/        # 创建页
│   │   └── [id]/page.tsx  # 详情页
│   ├── courses/           # 课程（AI 公开课）
│   ├── apps/              # 工具推荐
│   │   ├── page.tsx       # 列表页（含编辑弹窗）
│   │   └── create/        # 创建页
│   ├── competitions/      # AI 大赛
│   ├── admin/             # 管理后台
│   │   ├── review/        # 内容审核（工具 + 案例，Tabs 切换）
│   │   ├── users/         # 用户管理
│   │   ├── reviews/       # 评审管理（大赛评审）
│   │   ├── push/          # 飞书推送
│   │   ├── reminders/     # 提醒管理
│   │   └── settings/      # 平台设置
│   ├── profile/           # 个人中心
│   ├── login/             # 登录
│   └── api/               # API 路由
│       ├── resources/     # 工具管理 API
│       ├── cases/         # 案例 API
│       │   ├── route.ts   # POST 创建 / PATCH 审核
│       │   ├── admin/     # GET/PUT 管理员操作
│       │   └── [id]/      # GET 单案例详情
│       └── users/         # 用户 API
│           └── list/      # GET 轻量用户列表
├── components/            # 公共组件
│   ├── Navigation.tsx     # 导航栏
│   ├── HighlightSweep.tsx # 标题 shimmer 动效
│   └── SearchInput.tsx    # 搜索输入框
├── lib/                   # 工具库
│   ├── auth-context.tsx   # 认证上下文
│   ├── supabase.ts        # Supabase 客户端
│   ├── constants.ts       # 常量枚举
│   └── supabase-admin.ts  # Supabase Admin 客户端
└── types/
    └── index.ts           # 类型定义
```

### 权限控制

- `useAuth()` 提供 `{ user, isAdmin, loading, signOut, refreshUser }`
- `isAdmin` 由 `user?.roles` 数组包含 `'admin'` 或 `'moderator'` 决定
- admin 操作：审核内容、编辑任意案例/工具、标精选、管理用户
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

# 飞书 OAuth
FEISHU_APP_ID=xxx
FEISHU_APP_SECRET=xxx

# 应用 URL
NEXT_PUBLIC_APP_URL=https://hras-ai-land.vercel.app
```

## 部署

- **Vercel**：自动从 main 分支部署
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
