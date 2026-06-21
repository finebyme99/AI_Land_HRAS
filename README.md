# AI Land (AILand)

HR AI 社区平台，面向 HRAS 团队，集成案例库、课程、AI 大赛、应用推荐等模块。

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
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (API 路由用) |

飞书应用凭证存于 `feishu_apps` 表（admin UI），不在 env 中。详见 CONTRIBUTING.md。

## 项目结构

```
src/
├── app/              # Next.js App Router 页面
│   ├── api/          # API 路由
│   ├── admin/        # 管理后台
│   ├── wish-pool/    # 场景大全（三Tab视图）
│   ├── resources/    # 课程资源（课程+工具）
│   ├── competitions/ # AI 大赛
│   └── page.tsx      # 首页（居中Hero+5项glass指标带）
├── components/       # 共享组件（Navigation/ChoDashboard/DetailListBlock/HighlightSweep/SearchInput/EntryCard）
└── lib/              # 工具函数 (Supabase、飞书、认证、bitable映射、导出图片样式)
```

## 权限与管理后台

- 管理后台权限使用轻量 RBAC：`roles` / `role_permissions` / `user_roles` 三表，权限点在 `src/lib/permissions/registry.ts` 声明。
- 用户权限入口为 `/admin/roles`，包含 `角色列表`、`权限矩阵`、`用户授权` 三个视图。
- 旧 `/admin/users` 保留为兼容跳转，自动重定向到 `/admin/roles?tab=users`。
- `admin` 角色默认拥有全部权限；`reviewer_roles` 仍是独立的评审维度授权，不并入 RBAC。

## 详细规范

见 `CONTRIBUTING.md` 和 `AGENTS.md`。
