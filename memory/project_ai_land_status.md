---
name: AI Land 项目进度
description: HRAS AI岛 项目当前开发进度，唤醒词"继续做AI Land"时读取
type: project
---

**项目名**：HRAS AI岛（英文名：HRAS AI Land）
**仓库**：https://github.com/finebyme99/AI_Land_HRAS
**本地路径**：/Users/apple/Q/AI/26AI落地/AILand
**生产地址**：https://hras-ai-land.vercel.app

## 技术栈

- 前端：Next.js 16.2.6 + React 19.2.4 + TypeScript 5 + Tailwind CSS 4
- UI：Ant Design 6.4.3（App.useApp() 获取 message/notification）
- 后端：Supabase BaaS（PostgreSQL + RLS）
- 认证：飞书 OAuth（cookie-based，非 Supabase Auth）
- 部署：Vercel（auto-deploy from main）

## 关键架构洞察

**RLS 与认证不匹配**：Supabase RLS 使用 `auth.uid()`，但项目用飞书 cookie 认证。导致 `auth.uid()` 永远为 null，所有客户端写入都被 RLS 阻止。

**解决方案**：所有写入操作必须通过 API routes（`src/app/api/`），使用 `getSupabaseAdmin()`（service role key）绕过 RLS。

## 页面状态（全部已接入 Supabase）

- [x] 首页 — Hero 双栏（文字 + 动态数据看板）+ 统计卡片
- [x] 案例库 — 列表/详情/创建
- [x] 公开课 — 列表/详情/创建
- [x] 应用推荐 — 列表/详情
- [x] AI大赛 — 参赛方案卡片（飞书 Base 同步）+ hras-2026 iframe
- [x] 个人中心 — 个人资料/收藏/贡献/通知/设置
- [x] 登录 — 飞书 OAuth 流程
- [x] 管理员 — 用户管理（/admin/users）+ 平台设置（/admin/settings）

## API 路由（写入操作）

| 路由 | 功能 |
|------|------|
| `/api/auth/feishu` | 飞书 OAuth 发起 |
| `/api/auth/feishu/callback` | OAuth 回调 + cookie 设置 |
| `/api/auth/me` | 获取当前用户 |
| `/api/auth/logout` | 登出 |
| `/api/topics` | 创建话题 |
| `/api/comments` | 创建评论 |
| `/api/answers` | 创建回答 |
| `/api/interactions` | 点赞/收藏/取消 |
| `/api/admin/users` | 用户管理（GET 列表/PATCH 改角色）|
| `/api/admin/settings` | 平台设置（GET/PUT）|
| `/api/competitions/sync` | 读取飞书 Base 赛事方案数据 |

## 已完成功能

- Glassmorphism 全站风格（21 个页面重写）
- 飞书 OAuth 登录（cookie session）
- 角色权限控制（user/contributor/moderator/admin）
- 精选标记功能（admin/moderator）
- 动态数据看板（IntersectionObserver 动画计数器）
- 管理员后台（用户管理 + 平台设置）
- 导航栏响应式（桌面胶囊 + 移动端抽屉 + 底部 tab）
- HRAS Logo 集成
- 评论/点赞/收藏 API
- 话题/回答创建 API

## 待完成

- [ ] 运行 `008_platform_settings_award_count.sql` 迁移（Supabase Dashboard）
- [ ] 模块 feat 分支可能与 main 有分歧，需要检查/合并
- [ ] 内容审核后台（轻量实现）
- [ ] 多语言支持
- [ ] 飞书消息通知
- [ ] mock-data.ts 清理（仍存在于 src/lib/）

## 设计系统

- **风格**：Glassmorphism 玻璃拟态
- **配色**：深蓝 `#1a3a8a` + 暖橙 `#F27F22`
- **字体**：Outfit（标题）+ Noto Sans SC（正文）
- **背景**：暖米白 `#f5f0eb` + 浮动 blob 动画
- **卡片**：`rgba(255,255,255,0.45)` + `backdrop-filter: blur(20px)`
- **详细规范**：见 CONTRIBUTING.md

## 唤醒词

用户说"继续做AI Land"时：
1. 读取此文件了解进度
2. 读 CONTRIBUTING.md 了解技术约束
3. 读 PRD.md 或飞书评论确认最新需求
4. 接着上次的进度继续开发
