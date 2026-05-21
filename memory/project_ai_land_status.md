---
name: AI Land 项目进度
description: HRAS AI岛 项目当前开发进度，唤醒词"继续做AI Land"时读取
type: project
---

**项目名**：HRAS AI岛（英文名：HRAS AI Land）
**仓库**：https://github.com/finebyme99/AI_Land_HRAS
**本地路径**：/Users/apple/Q/AI/26AI在集团落地/AILand

## 技术栈（已确认）

- 前端：Next.js 16 + React 19 + TypeScript + Tailwind 4
- UI：Ant Design 6（需配置 transpilePackages）
- 后端：Supabase BaaS（认证 + PostgreSQL + 存储 + 实时订阅）
- AI：国产大模型（OpenAI 协议接入）
- 多语言：中英双语

## 环境变量（已配置）

`.env.local` 已填入：
- Supabase URL / Anon Key / Service Role Key
- NEXT_PUBLIC_APP_URL=http://localhost:3000
- FEISHU_APP_ID / FEISHU_APP_SECRET — **注意：当前填的是「test节假日日历」应用的凭证，用户需要换成「HSSC集成助手」的凭证**

## 数据库（已部署）

- Schema 已成功部署到 Supabase（16 张表 + RLS + 函数）
- 种子数据已插入（5 用户、1 活动、5 案例、4 话题、3 课程+12 章节、3 应用）
- 迁移文件：`supabase/migrations/full_migration.sql`（含 DROP 清理）
- 种子数据：`supabase/migrations/003_seed_data.sql`

## 页面状态（已接入真实数据）

所有页面已从 mock-data 切换到 Supabase 查询：
- [x] 首页 Dashboard — 统计用 count 查询，内容用 limit 截取
- [x] AI 案例库列表 — 支持搜索/分类/难度筛选，有 debounce
- [x] AI 案例详情 — Supabase 查询 + 浏览量自增
- [x] AI 话题列表 — 支持排序/标签筛选，有 debounce
- [x] AI 话题详情 — Supabase 查询 + 回答列表
- [x] AI 大赛列表 — 按状态分组显示
- [x] AI 大赛详情 — Supabase 查询
- [x] AI 公开课列表 — 支持搜索/分类/难度/形式筛选
- [x] AI 课程详情 — Supabase 查询 + 章节列表
- [x] AI 应用推荐列表 — 支持搜索/分类筛选
- [x] AI 应用详情 — Supabase 查询
- [x] 个人中心 — 用 useAuth() 真实用户数据
- [x] 我的贡献 — 用 auth user_id 查 Supabase
- [x] 个人设置 — 用 useAuth() 显示用户信息

## 前觉风格（已完成 — Glassmorphism 玻璃拟态风格）

已全面重写所有页面（21个文件），采用 **Glassmorphism（玻璃拟态）** 风格：

**设计语言：**
- 字体：Outfit（英文/标题）+ Noto Sans SC（中文正文）
- 配色：HRAS logo 品牌色 — 深蓝 `#1a3a8a` + 暖橙 `#F27F22`
- 背景：暖米白 `#f5f0eb` + 4 个浮动 blob 动画（深蓝/橙/深橙/浅蓝）
- 卡片：`rgba(255,255,255,0.45)` 背景 + `backdrop-filter: blur(20px)` + 白色边框
- 渐变：`linear-gradient(135deg, #1a3a8a, #F27F22)` 用于按钮、logo、hero 文字
- 交互：卡片 hover 上浮 + 顶部渐变条显现、导航胶囊悬停效果
- 特效：shimmer 渐变文字动画、CursorBot 鼠标跟随小机器人

**风格参考文件：** `glassmorphism-preview.html`

**已重写文件：**
- `globals.css` — 全新设计 token、glass 工具类、blob 动画、字体
- `layout.tsx` — Outfit/Noto Sans SC 字体 + blob 背景注入 + CursorBot
- `antd-registry.tsx` — navy/orange 主题 token
- `Navigation.tsx` — 毛玻璃导航栏 + gradient logo + 胶囊悬停
- `page.tsx`（首页）— 居中 Hero + shimmer 文字 + glass 统计卡片
- 5 个列表页 — glass 卡片 + hover 渐变顶栏
- 5 个详情页 — glass 内容块 + navy/orange 交互色
- 5 个个人中心页 + login + 2 个创建页
- `CursorBot.tsx` — 鼠标跟随小机器人组件

## 飞书 OAuth 登录（已完成）

- 流程：login 页 → /api/auth/feishu → 飞书授权 → /api/auth/feishu/callback → cookie session
- auth-context.tsx 已改为 cookie-based session（不依赖 Supabase Auth）
- 已修复 double logout bug
- 登录链接：`http://localhost:3000/login`

## 下一步（按优先级）

- [ ] 内容审核后台 — 轻量实现
- [ ] 多语言支持 — 待整体搭完后再做，先记待办
- [ ] 飞书消息通知 — 后续再做，先记待办
- [ ] Vercel 部署 — 本地跑通后再部署，需配置环境变量

## 唤醒词

用户说"继续做AI Land"时：
1. 读取此文件了解进度
2. 读 PRD.md 或飞书评论确认最新需求
3. 接着上次的进度继续开发
