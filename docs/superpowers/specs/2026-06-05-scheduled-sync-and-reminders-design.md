# AI 公开课定时同步 + 智能提醒设计

**日期**：2026-06-05
**状态**：已批准，待实现

## 目标

1. AI 公开课每天 19:40 自动从飞书多维表格同步增量内容
2. 提醒系统支持按人 / 按系统角色 / 按飞书群聊配置
3. 飞书提醒支持卡片格式（增量内容推送）
4. 群聊通过下拉选择（自动拉机器人已加入的群）

## 架构

### Cron 时间表

| 时间 (CST) | 路径 | 用途 |
|------------|------|------|
| 09:00 (UTC) | `/api/admin/reminders/send` (GET) | 现有：扫 reminders 通用 tick |
| 19:30 (UTC 11:30) | `/api/admin/reminders/send` (GET) | 复用同一 tick；Mon/Wed 19:30 的提醒靠 `next_send_at` 命中 |
| 19:40 (UTC 11:40) | `/api/cron/sync-courses` (GET) | 触发课程增量同步 |

> 保留 09:00 UTC tick 是为不破坏现有 9am 提醒。19:30 不需要新路由，靠 09:00 同一 tick 即可，cron 时间表对得上就行。

### 增量同步

- 在 `platform_settings` 表里存 `courses_last_synced_at`（key-value 形式）
- 改 `/api/courses/sync/route.ts`：接受 `?since=ISO` 参数 → 调飞书 API 时若有 `modified_since` 过滤则用，否则走全量（飞书 bitable 实际**不支持** `modified_since` 过滤，所以**真增量 = 上次同步后到现在的所有记录全量拉，upsert 天然幂等**）
- 同步完成后写回 `courses_last_synced_at = now()`
- 改 `/api/admin/courses/sync-cron` 路由（`CRON_SECRET` 校验），调同步函数传 `since=<last_synced_at>`

### Reminder 系统扩展

**Schema 改动**（migration `024_reminders_recipient_and_card.sql`）：

```sql
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS card_template JSONB;

ALTER TABLE reminder_targets ADD COLUMN IF NOT EXISTS recipient_type TEXT NOT NULL DEFAULT 'user';
ALTER TABLE reminder_targets ADD COLUMN IF NOT EXISTS recipient_id TEXT;
-- 回填：现有 user 类型行的 recipient_id 直接用 user_id
UPDATE reminder_targets SET recipient_id = user_id::text WHERE recipient_id IS NULL;
```

**recipient_type 取值**：
- `user` — 用现有 user_id 逻辑
- `role` — 取 `users WHERE '<role>' = ANY(roles)` 的列表，按 feishu_open_id 循环发
- `chat_id` — 调飞书 `im/v1/messages?receive_id_type=chat_id` 直接推群

**card_template**：可选 JSONB；存在时按飞书 card 协议发送，不存在时走现有 `title + content` 文本。

### 飞书群聊下拉

- 新建 `GET /api/admin/feishu/chats`：调飞书 `im/v1/chats` 拉机器人已加入的群聊列表（admin only）
- admin/reminders UI 选"群聊"模式时拉取并展示

### 涉及文件

| 操作 | 路径 |
|------|------|
| 改 | `vercel.json`（+1 cron） |
| 新建 | `supabase/migrations/024_reminders_recipient_and_card.sql` |
| 改 | `src/lib/reminder-service.ts`（recipient_type 路由 + card 发送） |
| 改 | `src/app/api/courses/sync/route.ts`（since 参数 + last_synced_at 写回） |
| 改 | `src/app/api/admin/courses/sync-cron`（新） |
| 改 | `src/app/api/admin/reminders/send/route.ts`（确保 card 走 sendFeishuCardMessage） |
| 新建 | `src/app/api/admin/feishu/chats/route.ts`（群列表） |
| 改 | `src/app/admin/reminders/page.tsx`（UI 改造：recipient_type 单选 + 三种选择器 + 卡片模板切换） |

## 验证矩阵

| 场景 | 期望 |
|------|------|
| 19:40 cron 触发 /api/cron/sync-courses | 飞书记录 upsert；platform_settings.courses_last_synced_at 更新；响应含 synced 计数 |
| Mon/Wed 19:30 提醒 | next_send_at 命中，发出 |
| 文本模式 + user 目标 | 现有行为不变 |
| 卡片模式 + 群聊目标 | 群收到飞书卡片 |
| 卡片模式 + role 目标 | 该 role 所有人收到卡片 |
| admin/reminders 选"按群聊" | 群聊下拉显示机器人加入的群 |

## 范围/取舍

- **不重构现有 9am tick**：保留，仅加 19:40 cron
- **不引入额外调度服务**：依赖 Vercel Cron（已用）
- **飞书 bitable 不支持 modified_since**：upsert 天然幂等，"增量" = 上次同步后到现在所有记录 + 写回 last_synced_at
- **角色仅支持应用内 roles**（admin/reviewer/course_admin），不接飞书部门
- **群聊来源**：飞书 API 拉机器人已加入的群（不维护手输）
- **卡片模板**：admin 在 UI 用 JSON 编辑器手填，预设几个示例放 helper
