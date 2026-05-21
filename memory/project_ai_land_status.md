---
name: AI Land 项目进度
description: HRAS AI岛 项目当前开发进度，唤醒词"继续做AI Land"时读取
type: project
---

**项目名**：HRAS AI岛（英文名：HRAS AI Land）
**仓库**：https://github.com/finebyme99/AI_Land_HRAS
**本地路径**：/Users/apple/Q/AI/26AI在集团落地/hr-ai-platform

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

## 前端视觉重设计（已完成 — Editorial Refined 风格）

已全面重写所有页面，采用 **Editorial Refined（精致编辑风格）**：

**设计语言：**
- 字体：Source Serif 4（衬线标题）+ DM Sans（正文无衬线），通过 Google Fonts 加载
- 色系：暖色调 — 赤陶棕 `#b85c38` 主色 + 森林绿 `#2d5a3d` 辅色 + 米白背景 `#faf8f5`
- 纹理：SVG 噪点纹理叠加（body::before），营造纸媒质感
- 卡片：圆角 12px + 暖色阴影 + hover 上浮动效
- 排版：杂志风格层次，衬线标题 + 无衬线正文

**已重写文件（19个页面）：**
- `globals.css` — 全新设计 token、字体、纹理、Ant Design 覆盖
- `layout.tsx` — 简化，字体通过 globals.css @import 加载
- `antd-registry.tsx` — 暖色主题 token
- `Navigation.tsx` — 毛玻璃效果、暖色交互
- `page.tsx`（首页）— Hero banner、统计卡片、编辑风格 section header
- `login/page.tsx` — 居中卡片、自定义按钮
- 5 个列表页（cases/topics/competitions/courses/apps）
- 5 个详情页（cases/topics/competitions/courses/apps [id]）
- 2 个创建页（cases/topics create）
- 4 个个人中心页（profile/contributions/settings/bookmarks/notifications）

**修复的遗留问题：**
- `cases/create/page.tsx` 原引用已删除的 `mock-data`，已改为 Supabase 查询 + constants

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
