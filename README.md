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
└── lib/              # 工具函数 (Supabase、飞书、认证、bitable映射)
```

## 详细规范

见 `CONTRIBUTING.md` 和 `AGENTS.md`。
