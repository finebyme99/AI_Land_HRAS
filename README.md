# AI Land (AILand)

<p align="center">
  <a href="#english">English</a> | <a href="#中文">中文</a>
</p>

## English

AI Land is an HR AI community platform for the HRAS team. It brings together the scenario library, courses, AI competitions, and recommended AI applications in one place.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19 + Ant Design 6 + Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL + RLS)
- **Authentication**: Feishu OAuth
- **Deployment**: Vercel

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key, used by API routes |

Feishu app credentials are stored in the `feishu_apps` table and managed through the admin UI. They are not stored in environment variables. See `CONTRIBUTING.md` for details.

## Project Structure

```text
src/
├── app/              # Next.js App Router pages
│   ├── api/          # API routes
│   ├── admin/        # Admin console
│   ├── wish-pool/    # Scenario library with three tab views
│   ├── resources/    # Courses and resources, including courses and tools
│   ├── competitions/ # AI competitions
│   └── page.tsx      # Home page with centered hero and 5-item glass metrics strip
├── components/       # Shared components: Navigation, ChoDashboard, resource cards, EntryCard, etc.
└── lib/              # Utilities: Supabase, Feishu, auth, bitable mapping, resource normalization, export-image styles
```

## Permissions And Admin

- The admin console uses lightweight RBAC through the `roles`, `role_permissions`, and `user_roles` tables. Permission points are declared in `src/lib/permissions/registry.ts`.
- User permission management is available at `/admin/roles`, with `Role List`, `Permission Matrix`, and `User Assignment` views.
- The legacy `/admin/users` route is kept for compatibility and redirects to `/admin/roles?tab=users`.
- The `admin` role has all permissions by default. `reviewer_roles` remains a separate review-dimension authorization model and is not merged into RBAC.
- The `user` role has basic frontend and submission capabilities by default. The tool self-send Feishu card capability is controlled by `resource.generate-feishu-card` and is granted to all regular users by default.

## Resources And Feishu Cards

- The tools page can generate a visual Feishu card for a single tool and send it to the currently logged-in user.
- API: `POST /api/resources/card-to-me`, with body `{ "resourceId": "<apps.id>" }`.
- The server reads the current user from the `feishu_user_id` cookie, looks up that user's `feishu_open_id`, and sends with `receive_id_type=open_id`. It does not broadcast to group chats.
- The card template reuses `src/lib/feishu-cards.ts#buildResourceCard`. The tools entry point is `/resources?tab=apps`.

## Competition Snapshot Sync

- Scenario library and AI competition pages read `competition_submissions` snapshots from Supabase by default.
- Feishu bitable data refreshes only through admin-triggered sync buttons or the Vercel cron route `GET /api/cron/sync-competitions`.
- Sync code preserves historical submission IDs that already have review records, then writes the latest Feishu fields onto that ID and removes duplicate shadow rows.

## Detailed Guidelines

See `CONTRIBUTING.md`, `AGENTS.md`, and `docs/operator-runbook.md`.

## 中文

AI Land 是面向 HRAS 团队的 HR AI 社区平台，集成场景大全、课程、AI 大赛、应用推荐等模块。

## 技术栈

- **框架**: Next.js 16 (App Router)
- **UI**: React 19 + Ant Design 6 + Tailwind CSS 4
- **后端**: Supabase (PostgreSQL + RLS)
- **认证**: 飞书 OAuth
- **部署**: Vercel

## 本地开发

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key，供 API 路由使用 |

飞书应用凭证存于 `feishu_apps` 表，并通过 admin UI 管理，不放在环境变量中。详见 `CONTRIBUTING.md`。

## 项目结构

```text
src/
├── app/              # Next.js App Router 页面
│   ├── api/          # API 路由
│   ├── admin/        # 管理后台
│   ├── wish-pool/    # 场景大全（三 Tab 视图）
│   ├── resources/    # 课程与资源（课程 + 工具）
│   ├── competitions/ # AI 大赛
│   └── page.tsx      # 首页（居中 Hero + 5 项 glass 指标带）
├── components/       # 共享组件：Navigation、ChoDashboard、资源卡片、EntryCard 等
└── lib/              # 工具函数：Supabase、飞书、认证、bitable 映射、资源字段归一化、导出图片样式
```

## 权限与管理后台

- 管理后台权限使用轻量 RBAC：`roles` / `role_permissions` / `user_roles` 三表，权限点在 `src/lib/permissions/registry.ts` 声明。
- 用户权限入口为 `/admin/roles`，包含 `角色列表`、`权限矩阵`、`用户授权` 三个视图。
- 旧 `/admin/users` 保留为兼容跳转，自动重定向到 `/admin/roles?tab=users`。
- `admin` 角色默认拥有全部权限；`reviewer_roles` 仍是独立的评审维度授权，不并入 RBAC。
- `user` 角色默认拥有基础前台/投稿能力；工具卡片自发飞书能力由 `resource.generate-feishu-card` 控制，默认授予所有普通用户。

## 资源与飞书卡片

- 工具页支持把单个工具生成飞书可视化卡片并发送给当前登录用户本人。
- API：`POST /api/resources/card-to-me`，body 为 `{ "resourceId": "<apps.id>" }`。
- 服务端按 `feishu_user_id` cookie 查询当前用户的 `feishu_open_id`，使用 `receive_id_type=open_id` 发送，不会群发到群聊。
- 卡片模板复用 `src/lib/feishu-cards.ts#buildResourceCard`，工具列表入口为 `/resources?tab=apps`。

## 大赛快照同步

- 场景大全和 AI 大赛页面默认读取 Supabase 的 `competition_submissions` 快照。
- 飞书多维表数据只通过管理员同步按钮或 Vercel 定时任务 `GET /api/cron/sync-competitions` 刷新。
- 同步逻辑会保留已有评审记录关联的历史方案 ID，把最新飞书字段写回该 ID，并清理重复影子行。

## 详细规范

见 `CONTRIBUTING.md`、`AGENTS.md` 和 `docs/operator-runbook.md`。
