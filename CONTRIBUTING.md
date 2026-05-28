# HRAS AI Land 并行开发规范

## 项目概述

HRAS AI Land 是 HR AI 社区平台，基于 Next.js 16 + Supabase + 飞书 OAuth。

## 分支策略

```
main (稳定版，Vercel 生产部署源)
├── feat/case-module    ← 案例库模块
├── feat/course-module  ← 课程模块
├── feat/topic-module   ← 问答话题模块
├── feat/app-module     ← 应用推荐模块
└── feat/xxx-module     ← 按需创建新模块
```

### 分支规则

1. **main 分支**：稳定版，所有功能合并后才更新，触发 Vercel 自动部署
2. **feat/xxx-module**：功能分支，每个模块独立开发，互不干扰
3. **禁止直接在 main 上开发功能**：所有功能必须在 feat 分支完成后再 PR 合并

## 开发工作流

### 启动新窗口

```bash
# 1. 进入项目目录
cd /Users/apple/Q/AI/26AI落地/AILand

# 2. 切到目标分支
git checkout feat/case-module

# 3. 启动 Claude Code
claude
```

### 开发过程中

1. 所有 commit 自动在当前 feat 分支上
2. 定期 `git push origin feat/xxx-module` 推送到远程备份
3. 遇到冲突或跨模块改动，先暂停并同步

### 完成后合并

```bash
# 1. 推送分支
git push origin feat/case-module

# 2. 在 GitHub 创建 PR: feat/case-module → main

# 3. Review 后合并

# 4. 合并后删除远程分支（可选）
git push origin --delete feat/case-module
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
│   ├── cases/             # 案例库
│   │   ├── page.tsx       # 列表页
│   │   └── [id]/page.tsx  # 详情页
│   ├── courses/           # 课程
│   ├── topics/            # 问答
│   ├── apps/              # 应用推荐
│   ├── competitions/      # AI 大赛
│   ├── profile/           # 个人中心
│   ├── login/             # 登录
│   └── api/               # API 路由
├── components/            # 公共组件
│   └── Navigation.tsx     # 导航栏
├── lib/                   # 工具库
│   ├── auth-context.tsx   # 认证上下文
│   ├── supabase.ts        # Supabase 客户端
│   ├── constants.ts       # 常量
│   └── mock-data.ts       # 模拟数据（待删除）
└── types/
    └── index.ts           # 类型定义
```

### 权限控制

- `useAuth()` 提供 `{ user, isAdmin, signOut, refreshUser }`
- `isAdmin` 由 `user?.role === 'admin' || user?.role === 'moderator'` 决定
- admin 操作：提交案例、发布课程、标精选、切换 featured
- 普通用户：创建话题、回答、点赞、收藏

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

## 常见问题

### Q: 两个分支改了同一个文件怎么办？
A: 后合并的分支需要解决冲突。建议提前沟通，或让一个分支先合。

### Q: 需要跨模块改动怎么办？
A: 在当前分支直接改，但要在 PR 描述中说明，方便 review。

### Q: 如何同步 main 的最新代码到 feat 分支？
A: `git checkout feat/xxx && git merge main` 或 `git rebase main`

## 自检规范

**所有改动必须自行验证后再提交，不要依赖用户发现 bug。**

1. **页面类改动**：用 `curl` 验证 HTTP 状态码和关键 HTML 片段
2. **API 类改动**：用 `curl` 调用接口，确认返回值符合预期
3. **静态资源**：确认文件存在且 dev server 能正确 serve（Next.js 不自动 serve 目录下的 index.html，需用完整路径）
4. **导航/路由**：确认按钮链接指向正确，页面切换后无残留元素
5. **数据类改动**：确认数据库迁移文件、API 路由、前端消费端三者字段一致
