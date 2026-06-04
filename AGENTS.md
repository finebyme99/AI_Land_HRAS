<!-- BEGIN:project-conventions -->
# 项目规范（必读）

进入此项目时，必须先读取以下文件：

1. `CONTRIBUTING.md` — 技术架构约束、样式规范、文件结构、数据库迁移、部署配置
2. `AGENTS.md`（本文件）— 分支策略 + Next.js 特殊规则

## 分支策略

当前阶段（2026-06）直接在 **main** 分支开发和提交。Vercel 部署源是 main，push 即自动部署。

## 详细规范

见 `CONTRIBUTING.md`，包含：
- 技术栈约束（Next.js 16、React 19、Ant Design 6、Supabase）
- 样式规范（Glassmorphism、CSS 变量、字体、主色）
- 文件结构说明
- 权限控制机制
- 数据库迁移流程
- 部署配置
<!-- END:project-conventions -->

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
