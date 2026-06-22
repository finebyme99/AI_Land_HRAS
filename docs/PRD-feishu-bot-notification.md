# AI岛飞书推送 PRD

> v2.1 · 2026-06-03 · 手动推送控制台

## 背景

AI岛平台已有案例、课程、工具资源、大赛方案等内容，管理员需要将精选内容主动推送到飞书群，引导用户回流浏览。当前无任何推送能力，全靠用户自发访问。

## 目标

- 管理员在后台「推送控制台」手动选择要推送的内容
- 从飞书群列表中选择推送目标（支持外部群）
- 多选内容，实时预览飞书卡片效果（右侧预览）
- 点击推送，内容以飞书消息卡片形式发送到指定群聊
- 卡片布局自动匹配内容类型

## 一、推送控制台

### 1.1 入口

管理员后台 → 左侧导航「飞书推送」

### 1.2 页面布局（左右分栏）

——这里的内容，完全参照各模块现有数据内容选择，支持我选择需要在卡片上展示的字段。不要新建字段
```
┌──────────────────────────────────┬─────────────────────┐
│  推送控制台                        │  卡片预览             │
│                                   │                      │
│  ① 选择目标群聊                    │  ┌──────────────┐   │
│  ┌───────────────────────────┐   │  │ 🛠️ 新工具推荐  │   │
│  │ 🔍 搜索群聊...             │   │  │ ────────────── │   │
│  │                           │   │  │ {name}         │   │
│  │ ☑ HRAS AI岛话题群 (内部)   │   │  │ 分类：{cat}    │   │
│  │ ☐ HRAS-外部交流群 (外部)   │   │  │ {description}  │   │
│  │ ☐ AI大赛评审群 (内部)      │   │  │ ────────────── │   │
│  │                           │   │  │ [查看详情 →]    │   │
│  │ 已选：HRAS AI岛话题群       │   │  └──────────────┘   │
│  └───────────────────────────┘   │                      │
│                                   │  ┌──────────────┐   │
│  ② 选择内容（多选）                │  │ 🎓 新课程上线  │   │
│  ┌─────┬─────┬─────┬─────┐      │  │ ────────────── │   │
│  │ 工具 │ 公开课│ 案例 │ 大赛 │      │  │ {title}        │   │
│  └─────┴─────┴─────┴─────┘      │  │ 讲师：{instr}  │   │
│                                   │  │ 难度：{diff}   │   │
│  ┌───────────────────────────┐   │  │ ────────────── │   │
│  │ ☑ AI自动识别整理仓库...    │   │  │ [开始学习 →]   │   │
│  │ ☑ AI嵌入行政服务台...      │   │  └──────────────┘   │
│  │ ☐ 智能排班系统...          │   │                      │
│  │                           │   │  已选 2 条内容         │
│  │ 已选 2 条                  │   │                      │
│  └───────────────────────────┘   │                      │
│                                   │                      │
│  ③ 操作栏                         │                      │
│  [ 📤 推送到 HRAS AI岛话题群 ]    │                      │
│  共 2 条内容 → 1 个群              │                      │
└──────────────────────────────────┴─────────────────────┘
```

### 1.3 操作流程

```
1. 管理员进入推送控制台
2. 搜索并选择目标群聊（从飞书 API 拉取群列表）
3. 切换内容类型 Tab（工具/公开课/案例/大赛）
4. 勾选要推送的内容（多选，跨类型可选）
5. 右侧实时预览选中内容的卡片效果
6. 确认无误，点击「推送到 XXX 群」
7. 调用飞书 API 逐条发送卡片消息
8. 记录推送日志
```

## 二、目标群聊选择

### 2.1 从飞书获取群列表

调用飞书 API `GET /im/v1/chats` 获取机器人所在的群列表，支持：

- 内部群（`chat_type: private`）
- 外部群（`chat_type: external`）
- 按群名搜索过滤

### 2.2 API 设计

#### GET /api/admin/push/chats — 获取群列表

```typescript
// 调用飞书 im/v1/chats，返回机器人所在的所有群
// Response
{
  chats: [
    { chat_id: 'oc_xxx', name: 'HRAS AI岛话题群', chat_type: 'private', owner_id: '...' },
    { chat_id: 'oc_yyy', name: 'HRAS-外部交流群', chat_type: 'external', owner_id: '...' },
  ]
}
```

### 2.3 群列表 UI

- 默认显示所有群，支持搜索框按群名过滤
- 显示群名 + 群类型标签（内部/外部）
- 单选目标群（radio 选中态）
- 记住上次选择（存 localStorage）

## 三、内容选择

### 3.1 内容类型 Tab

| Tab | 数据来源 | 优先级 |
|-----|---------|--------|
| 工具推荐 | `apps` 表 | P0 |
| 公开课 | `courses` 表 | P0 |
| 案例库 | `cases` 表 | P1 |
| 大赛方案 | `competition_submissions` 表 | P2 |

### 3.2 列表展示

每个内容项显示：
- ☐ 多选框
- 标题/名称
- 分类标签
- 简介（截取前50字）
- 状态（已发布/待审核等）

### 3.3 多选逻辑

- 支持跨类型多选（同时选工具和课程一起推）
- 选中项高亮显示
- 显示已选总数
- 切换 Tab 时保留已选状态

## 四、卡片布局

### 4.1 自动匹配规则

系统根据 `content_type` 自动选择模板，管理员无需手动排版。**完全使用现有数据库字段，不新建任何字段。** 管理员可在预览时选择要展示哪些字段。

```
content_type = 'course'    → 公开课卡片模板（Phase 1）
content_type = 'resource'  → 工具推荐卡片模板（Phase 2）
content_type = 'case'      → 案例卡片模板（Phase 2）
content_type = 'submission' → 大赛方案卡片模板（Phase 2）
```

### 4.2 工具推荐卡片
——卡片标题全部用turquoise这个颜色。跳转链接全部用卡片按钮

```
┌─────────────────────────────────────┐
│ 🛠️ 新工具推荐                 (紫色) │
├─────────────────────────────────────┤
│  {name}                    ← 加粗   │
│  适用场景：{category}                │
│                                     │
│  {description}             ← 摘要   │
│                                     │
│  [ 🔗 查看详情 → ]    ← 跳转AI岛    │
└─────────────────────────────────────┘
```

| 卡片字段 | 数据来源 | 说明 |
|---------|---------|------|
| name | `apps.name` | 工具名称 |
| category | `apps.category` | 工具分类 |
| description | `apps.description` | 工具描述，截取前120字 |
| link | `{APP_URL}/resources?tab=apps` | AI岛工具页 |

### 4.2.1 个人自发工具卡片

工具页支持普通用户点击「生成飞书卡片」，把某个工具推荐生成飞书可视化卡片并发送给自己，方便复制、转发或收藏。

- API：`POST /api/resources/card-to-me`
- 入参：`{ "resourceId": "<apps.id>" }`
- 权限：`resource.generate-feishu-card`，默认授予 `user` 角色
- 接收人：当前登录用户的 `users.feishu_open_id`（`receive_id_type=open_id`），不是群聊 `chat_id`
- 模板：复用工具推荐卡片模板 `buildResourceCard`

### 4.3 公开课卡片（Phase 1）

```
┌─────────────────────────────────────┐
│ 🎓 新课程上线              (turquoise)│
├─────────────────────────────────────┤
│  {title}                    ← 加粗   │
│  讲师：{instructor}                  │
│  难度：{difficulty}                  │
│                                     │
│  {description}             ← 简介   │
│                                     │
│  [ 📖 查看详情 ]     ← 主按钮 turquoise│
└─────────────────────────────────────┘
```

**Header 颜色**：turquoise（统一）
**跳转链接**：按钮形式（tag: button, type: primary, url: 课程链接）

| 卡片字段 | 数据来源 | 说明 |
|---------|---------|------|
| title | `courses.title` | 课程标题 |
| instructor | `courses.instructor` | 讲师姓名 |
| difficulty | `courses.difficulty` | 难度等级 |
| description | `courses.description` | 课程简介 |
| link | `{APP_URL}/courses/{id}` | 课程详情页 |

### 4.4 案例卡片
——案例、大赛、工具先放着，先把公开课模块推送做出来。

```
┌─────────────────────────────────────┐
│ 📚 新案例推荐                 (蓝色)  │
├─────────────────────────────────────┤
│  {title}                    ← 加粗   │
│  作者：{author} · {department}       │
│  分类：{category}                    │
│                                     │
│  {summary}                 ← 摘要   │
│                                     │
│  👍 {like_count} · 💬 {comment_count}│
│                                     │
│  [ 🔍 查看详情 → ]    ← 跳转AI岛    │
└─────────────────────────────────────┘
```

### 4.5 大赛方案卡片

```
┌─────────────────────────────────────┐
│ 📋 大赛方案速览               (橙色)  │
├─────────────────────────────────────┤
│  {title}                    ← 加粗   │
│  提交人：{submitter} · {team}        │
│  赛道：{track}                      │
│                                     │
│  {afterProcess}            ← 方案   │
│                                     │
│  [ 📋 查看方案 → ]    ← 跳转AI岛    │
└─────────────────────────────────────┘
```

## 五、推送日志

### 5.1 数据模型

```sql
CREATE TABLE push_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  content_title TEXT,
  target_chat_id TEXT NOT NULL,
  target_chat_name TEXT,
  card_json JSONB,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  pushed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_push_logs_created ON push_logs(created_at DESC);
```

### 5.2 推送历史

推送控制台底部展示历史列表：

| 时间 | 类型 | 标目 | 目标群 | 状态 | 操作人 |
|------|------|------|--------|------|--------|
| 06-03 14:30 | 工具 | AI自动识别... | HRAS AI岛群 | ✅ 已发送 | admin |
| 06-03 14:30 | 课程 | ChatGPT办公... | HRAS AI岛群 | ✅ 已发送 | admin |

## 六、技术方案

### 6.1 核心文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/app/admin/push/page.tsx` | 新建 | 推送控制台页面（左右分栏） |
| `src/app/api/admin/push/chats/route.ts` | 新建 | 获取飞书群列表 |
| `src/app/api/admin/push/route.ts` | 新建 | 执行推送 + 预览 |
| `src/lib/feishu-cards.ts` | 新建 | 卡片模板构建器 |
| `src/lib/feishu-message.ts` | 已有 | 复用 sendFeishuCardMessage |
| `supabase/migrations/029_push_logs.sql` | 新建 | 推送日志表 |
| `src/app/admin/layout.tsx` | 修改 | 导航新增「飞书推送」 |

### 6.2 API 设计

#### GET /api/admin/push/chats

```typescript
// 调飞书 im/v1/chats，返回群列表
// Response: { chats: { chat_id, name, chat_type, avatar }[] }
```

#### GET /api/admin/push/preview

```typescript
// Request: ?type=resource&id=xxx  或  ?type=course&id=xxx
// Response: 飞书卡片 JSON
```

#### POST /api/admin/push

```typescript
// Request
{
  chat_id: string,
  items: { content_type: 'resource' | 'course' | 'case' | 'submission'; content_id: string }[]
}
// Response: { success: number; failed: number; errors?: string[] }
```

### 6.3 推送流程

```
点击「推送到 XXX 群」
    ↓
POST /api/admin/push { chat_id, items }
    ↓
校验权限（admin only）
    ↓
遍历 items，逐条：
  ├─ 查数据库取内容详情
  ├─ buildCardByType(content_type, content) 构建卡片
  ├─ sendFeishuCardMessage(chat_id, 'chat', card)
  └─ 记录 push_logs
    ↓
返回结果 { success, failed }
```

## 七、实施计划

| 阶段 | 内容 | 工期 |
|------|------|------|
| **Phase 1** | 推送控制台 + 公开课卡片 + 群列表 + 推送 | 2天 |
| **Phase 2** | 工具/案例/大赛卡片 + 推送历史 + 多类型混合推送 | 按需 |

## 八、涉及数据库变更

```sql
-- 029_push_logs.sql
CREATE TABLE push_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  content_title TEXT,
  target_chat_id TEXT NOT NULL,
  target_chat_name TEXT,
  card_json JSONB,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  pushed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_push_logs_created ON push_logs(created_at DESC);
```
