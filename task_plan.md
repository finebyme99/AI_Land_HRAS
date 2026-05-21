# Glassmorphism 视觉重构计划

## 目标
将全站从 Editorial Refined 风格切换到玻璃拟态（Glassmorphism）风格，配色对齐 HRAS logo：深蓝 `#0F2057` / `#1a3a8a` + 暖橙 `#F27F22`。

## 阶段

### 阶段 1：基础设施（globals.css + layout + antd） ✅ complete
- [x] `globals.css` — 重写 CSS 变量 + glass 工具类 + blob 动画 + Outfit/Noto Sans SC 字体
- [x] `layout.tsx` — 新字体 + blob 背景注入
- [x] `antd-registry.tsx` — navy/orange 主题

### 阶段 2：Navigation ✅ complete
- [x] `Navigation.tsx` — 毛玻璃导航栏 + gradient logo

### 阶段 3：首页 ✅ complete
- [x] `page.tsx` — gradient Hero + glass 卡片 + stat 卡片

### 阶段 4：列表页（5个） ✅ complete
- [x] `cases/page.tsx`, `topics/page.tsx`, `competitions/page.tsx`, `courses/page.tsx`, `apps/page.tsx`

### 阶段 5：详情页（5个） ✅ complete
- [x] `cases/[id]/page.tsx`, `topics/[id]/page.tsx`, `competitions/[id]/page.tsx`, `courses/[id]/page.tsx`, `apps/[id]/page.tsx`

### 阶段 6：创建页 + 登录 + 个人中心（8个） ✅ complete
- [x] `login/page.tsx`, `topics/create/page.tsx`
- [x] `profile/page.tsx`, `profile/contributions/page.tsx`, `profile/settings/page.tsx`, `profile/bookmarks/page.tsx`, `profile/notifications/page.tsx`

### 阶段 7：验证 ✅ complete
- [x] `npm run build` 通过，0 错误
- [x] 全站无残留旧颜色 `rgba(91,92,255,...)` / `#5b5cff` / `#00d4ff`

## 设计决策
- 字体：Outfit（英文/标题）+ Noto Sans SC（中文正文）
- 主色：`#1a3a8a`（深蓝）、`#F27F22`（暖橙）
- 背景：暖米白 `#f5f0eb` + 4 个浮动 blob 动画
- 卡片：`rgba(255,255,255,0.45)` 背景 + `backdrop-filter: blur(20px)` + 白色边框
- 渐变：`linear-gradient(135deg, #1a3a8a, #F27F22)` 用于按钮、logo、hero
