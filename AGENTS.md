<!-- BEGIN:project-conventions -->
# 项目规范（必读）

进入此项目时，必须先读取以下文件：

1. `CONTRIBUTING.md` — 并行开发规范、分支策略、技术架构约束、协作约定
2. `AGENTS.md`（本文件）— Next.js 特殊规则

## 并行开发分支

```
main (稳定版，Vercel 部署源)
├── feat/case-module    ← 案例库模块
├── feat/course-module  ← 课程模块
├── feat/topic-module   ← 问答话题模块
└── feat/app-module     ← 应用推荐模块
```

每个窗口 checkout 对应分支，所有 commit 在 feat 分支上，完成后 PR 合回 main。

## 分支切换命令

```bash
git checkout feat/case-module    # 案例库开发
git checkout feat/course-module  # 课程开发
git checkout feat/topic-module   # 问答开发
git checkout feat/app-module     # 应用推荐开发
```

## 详细规范

见 `CONTRIBUTING.md`，包含：
- 技术栈约束（Next.js 16、React 19、Ant Design 6、Supabase）
- 样式规范（Glassmorphism、CSS 变量、字体、主色）
- 文件结构说明
- 权限控制机制
- 数据库迁移流程
- 部署配置
- 协作约定
<!-- END:project-conventions -->

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
