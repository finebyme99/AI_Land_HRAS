---
name: AI Land 项目进度
description: HRAS AI岛 项目当前开发进度，唤醒词"继续做AI Land"时读取
type: project
---

**项目名**：HRAS AI岛（英文名：HRAS AI Land）
**仓库**：https://github.com/finebyme99/AI_Land_HRAS
**本地路径**：/Users/zt26278/Q/AI/26AI落地/AILand
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
| `/api/auth/feishu` | 飞书 OAuth 发起（多租户：?app_id=xxx） |
| `/api/auth/feishu/callback` | OAuth 回调（联合主键 upsert + 写 auth_logs） |
| `/api/auth/me` | 获取当前用户 |
| `/api/auth/logout` | 登出 |
| `/api/auth/login` `/api/auth/register` | 用户名密码兜底（**待下线**） |
| `/api/feishu-apps` | 飞书多租户应用 CRUD + 测试连通性（admin） |
| `/api/feishu-apps/public` | 公开列表（login 页用） |
| `/api/topics` | 创建话题 |
| `/api/comments` | 创建评论 |
| `/api/answers` | 创建回答 |
| `/api/interactions` | 点赞/收藏/取消 |
| `/api/admin/users` | 用户管理（GET 列表/PATCH 改角色）|
| `/api/admin/settings` | 平台设置（GET/PUT）|
| `/api/competitions/sync` | 飞书 Base 赛事方案同步（服务端过滤 + 附件去重） |
| `/api/competitions/reviews` | 评审评分（GET 查询 / POST 提交，8维加权） |
| `/api/competitions/reviews/export` | 评审数据 CSV 导出（管理员） |
| `/api/admin/competitions/overview` | 成效看板数据（CHO 复审，含飞书公式字段直同步） |
| `/api/cron/feishu-apps-health` | 飞书多租户应用连通性（每天 3 AM UTC） |

## 已完成功能

- Glassmorphism 全站风格（21 个页面重写）
- 飞书多租户 OAuth 登录（feishu_apps 表 + 联合主键，支持 3+ 家企业）
- 角色权限控制（user/contributor/moderator/admin/reviewer/course_admin）
- 精选标记功能（admin/moderator）
- 动态数据看板（IntersectionObserver 动画计数器）
- 管理员后台（用户管理 + 平台设置 + 评审管理 + 飞书应用配置 + 提醒管理）
- 导航栏响应式（桌面胶囊 + 移动端抽屉 + 底部 tab）
- HRAS Logo 集成
- 评论/点赞/收藏 API
- 话题/回答创建 API
- AI大赛评审系统（8维加权评分，三类评委角色，Popconfirm 提交）
- AI大赛评审一览页（CHO 复审）
- 成效看板（/admin/cho-dashboard）— 飞书公式字段直同步 + CompareCell 上下堆叠对比 + 公式提示横幅 + 表头 Tooltip + 排序/筛选
- 飞书同步优化（服务端过滤 + 附件去重 + 并行下载）
- 飞书 cron（课程同步 / 智能提醒 / 多租户应用连通性）
- 硬编码白名单清理（HARDCODED_REVIEWER_NAMES 已删，改 sync 回填）

## 待完成

- [ ] 验证 WX 飞书登录（让 WX 用户走一遍）
- [ ] 8 个 single-tenant 调用点迁到 `getTenantAccessTokenFor`（**用户 2026-06-05 决定先不动**，等 1 周观察期过再定）
- [ ] 1 周后下线用户名密码兜底
- [ ] 内容审核后台（轻量实现）
- [ ] 多语言支持
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
