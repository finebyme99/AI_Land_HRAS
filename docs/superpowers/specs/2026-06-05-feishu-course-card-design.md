# AI 公开课周报卡片 + 角色更名 — 设计 spec

**作者**：Claude（基于用户需求）
**日期**：2026-06-05
**状态**：待用户 review
**关联**：
- 角色基础 — `2026-06-05-course-admin-role-design.md`
- 提醒框架 — `2026-06-05-scheduled-sync-and-reminders-design.md`
- 多租户 SSO — `2026-06-05-feishu-external-sso-design.md`

> 角色说明已过期：2026-06-21 RBAC 已取代硬编码 `course_admin` 方案。本文的卡片、回调、定时提醒设计可继续参考；涉及课程运营授权时，使用 `course.sync` / `course.publish` 权限点和 `/admin/roles` 自定义角色，不再修改 `/admin/users` 增加固定 `course_admin` 选项。

---

## 1. 背景与目标

业务方要求 `course_admin`（中文：公开管理员 → **AI 课程管理员**）每周一 18:25 CST 收到一张飞书消息卡片，提醒"请及时在本期 AI 公开课结束后，更新课程信息"。卡片里要能让用户**直接在消息里填写课程字段并提交**，提交后：

1. 数据写入 `courses` 表（与"AI 岛新建公开课"完全相同的写入路径）
2. 原消息卡片原地变成"✅ 已提交：XXX"，避免重复提交
3. 新课程立即出现在 `/courses` 列表

不实现"未提交后追加提醒"——用户每看到一次就是一次机会，下周会再推。

---

## 2. 范围

### 包含

1. UI 中文名："公开管理员" → "AI 课程管理员"（DB key `course_admin` 不动）
2. 每周一 18:25 CST = 10:25 UTC，Vercel Cron 触发
3. 给所有 `users.roles @> ['course_admin']` 的用户推一张带 8 字段的交互式卡片
4. 卡片提交后写入 `courses` 表（复用 `POST /api/courses` 的 insert 逻辑）
5. 飞书侧用 `PATCH im/v1/messages/{message_id}` 把原卡片替换为"已提交 ✓"或"失败重试"

### 不包含

- 多租户卡片回调升级（仍走单租户 `getTenantAccessToken()`，与现有 8 个 shim 保持一致；下一轮再说）
- 重复提交的去重（仅做"已成功提交则不再重试"）
- 周二 / 周三补发提醒
- 删除 / 批量编辑卡片
- 把卡片管理搬到 admin UI（种子的 card_template 在 DB 里，但 UI 暂不暴露编辑入口；后面要加再加）
- 把 /courses "新建课程" 弹窗当前漏掉的 `description` / `duration` / `difficulty` 后端必填改写（仍沿用现状，handler 端用兜底值）

---

## 3. 架构与数据流

### 3.1 触发 + 发送

```
[Vercel Cron: 25 10 * * 1]
    → GET /api/cron/weekly-course-card
    → 校验 CRON_SECRET
    → executeReminders(false)
    → 查 reminders 表 → 命中种子的"补录本周公开课"（card_template 存的是 buildCourseInputCard() 输出的 JSON）
    → reminder_targets.role = 'course_admin' → 展开为 N 个用户
    → 对每个用户调 sendFeishuCardMessage(openId, 'open_id', card)
    → getTenantAccessToken() 拿默认 app token
    → POST im/v1/messages
    → 写 reminder_logs
    → updateNextSend() → 下周一 18:25
```

### 3.2 卡片交互 + 写库

```
用户在飞书填字段，点"提交"
    → 飞书 POST /api/feishu/card-callback
    → handler 验签：用 header.tenant_key 查 feishu_apps.encrypt_key
    → url_verification challenge 直接 200 响应
    → 路由 event_type = card.action.trigger + action.tag = form_submit + action.name = 'course_form'
    → handleCourseCardSubmit(form, messageId, openId)
        - 校验 title + instructor + content_type 必填
        - 调 insertCourseRow(...) 共享函数
        - success → replaceFeishuCard(messageId, buildSuccessCard(course))
        - fail    → replaceFeishuCard(messageId, buildErrorCard(err, form))
```

### 3.3 关键不变量

- 写入路径与 web 端 `POST /api/courses` 共用 `insertCourseRow()`，行为完全一致
- 卡片回调鉴权：必须能解密（tenant_key 在 feishu_apps 里有对应 encrypt_key）
- 重复触发：reminder_logs 1 分钟去重（已有）

---

## 4. 数据库改动

### Migration `025_course_card_support.sql`

```sql
-- A. feishu_apps 加 encrypt_key（卡片回调验签/解密用）
ALTER TABLE feishu_apps ADD COLUMN IF NOT EXISTS encrypt_key text;
COMMENT ON COLUMN feishu_apps.encrypt_key IS '飞书事件订阅的 Encrypt Key，用于解密卡片回调 payload';

-- B. 种子：周一 18:25 weekly reminder
--    card_template 直接存卡片 JSON（见 §6），reminder-service 会直接发。
INSERT INTO reminders (id, title, content, frequency, send_time, send_day, is_active, card_template, next_send_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-0000000a0001'::uuid,
  '📚 补录本周 AI 公开课',
  '',
  'weekly',
  '18:25',
  1,
  true,
  -- 见 §6 buildCourseInputCard() 输出（迁移文件里是同一份 JSON 字面量）
  '{ "config": { "wide_screen_mode": true }, ... }'::jsonb,
  -- 下周一 10:25 UTC（= 18:25 CST）
  date_trunc('day', now() AT TIME ZONE 'UTC')
    + (7 - EXTRACT(DOW FROM now() AT TIME ZONE 'UTC')::int) * interval '1 day'
    + interval '10 hours 25 minutes',
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

-- C. 目标：role = course_admin
INSERT INTO reminder_targets (reminder_id, recipient_type, recipient_id)
VALUES (
  '00000000-0000-0000-0000-0000000a0001'::uuid,
  'role',
  'course_admin'
) ON CONFLICT DO NOTHING;
```

> **注**：`next_send_at` 的计算是"下个周一 18:25 CST"= "下个周一 10:25 UTC"。Vercel Cron 第一次触发是按 schedule 走；reminders 表的 `next_send_at` 只在 executeReminders 后被 `updateNextSend()` 重写，初始值对 correctness 不重要，但能让 `reminders` 页面显示正常。

### 4.1 feishu_apps.encrypt_key 回填

需要 admin 在 **每个 feishu_apps 行** 回填 encrypt_key：
- 来源：飞书开放平台 → 应用 → 事件订阅 → "Encrypt Key" 字段
- 路径：管理后台 → 飞书应用管理 → 编辑 → 加密密钥
- 没有 encrypt_key 的 app：卡片回调会 401，但不影响其他模块

> **如果只有一个 feishu_apps（默认 app）影响最大**，卡片发出去后回不来。本期只保证**默认 app 有 encrypt_key** 即可用。

---

## 5. 新增 / 修改文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `supabase/migrations/025_course_card_support.sql` | 新 | 见 §4 |
| `src/lib/feishu-card.ts` | 新 | 验签 + 解密（飞书加密卡片回调）；暴露 `verifyAndDecryptCardEvent()` |
| `src/lib/course-card-handler.ts` | 新 | 业务处理：读 form_value → 写库 → 构造"已提交"卡片 |
| `src/lib/feishu-message.ts` | 改 | 加 `buildCourseInputCard()`（被迁移和 sendFeishuCardMessage 共用）、`replaceFeishuCard(messageId, card)`、`buildSuccessCard(course)`、`buildErrorCard(err, form)` |
| `src/lib/courses-insert.ts` | 新 | 抽 `insertCourseRow(data)` 共享函数（原 `POST /api/courses` 内的 insert 逻辑搬出来） |
| `src/app/api/courses/route.ts` | 改 | POST 改用 `insertCourseRow()`；PATCH 不变 |
| `src/app/api/feishu/card-callback/route.ts` | 新 | POST 端点 |
| `src/app/api/cron/weekly-course-card/route.ts` | 新 | GET 端点：CRON_SECRET 校验 + executeReminders(false) |
| `vercel.json` | 改 | 加 `{ "path": "/api/cron/weekly-course-card", "schedule": "25 10 * * 1" }` |
| `src/lib/auth-context.tsx` | 改 | 注释 "公开管理员" → "AI 课程管理员"；不动派生逻辑 |
| `src/app/admin/users/page.tsx` | 改 | 角色 select 选项的 label 改 |
| `src/app/admin/users/page.tsx` API 调用 | 改 | 若有 `ROLE_LABELS` 之类的常量文件，统一改 |
| （其他） | 改 | 全项目 grep "公开管理员" 替换；DB key `course_admin` 不动 |

---

## 6. 卡片模板（buildCourseInputCard 输出）

```ts
{
  config: { wide_screen_mode: true },
  header: {
    title: { tag: 'plain_text', content: '📚 补录本周 AI 公开课' },
    template: 'orange',
  },
  elements: [
    { tag: 'div', text: { tag: 'lark_md', content: '请在 **本周公开课结束** 后填写，提交后立即同步到 AI 岛。' } },
    { tag: 'hr' },
    {
      tag: 'form', name: 'course_form',
      elements: [
        { tag: 'input', name: 'title',
          label: { tag: 'plain_text', content: '课程标题 *' },
          placeholder: { tag: 'plain_text', content: '例：用 Claude Code 写周报' },
          input: { type: 'text', max_length: 100 } },
        { tag: 'input', name: 'instructor',
          label: { tag: 'plain_text', content: '讲师 *' },
          input: { type: 'text' } },
        { tag: 'select_static', name: 'content_type',
          label: { tag: 'plain_text', content: '内容形式 *' },
          options: [['video', '视频'], ['doc', '文档']] },
        { tag: 'date_picker', name: 'published_at',
          label: { tag: 'plain_text', content: '开课日期' },
          date_picker: { type: 'date' } },
        { tag: 'input', name: 'cover_image',
          label: { tag: 'plain_text', content: '封面图 URL' },
          input: { type: 'text' } },
        { tag: 'input', name: 'courseware_url',
          label: { tag: 'plain_text', content: '课件链接' },
          input: { type: 'text' } },
        { tag: 'input', name: 'video_url',
          label: { tag: 'plain_text', content: '视频链接' },
          input: { type: 'text' } },
        { tag: 'input', name: 'period',
          label: { tag: 'plain_text', content: '期数（如：第 12 期）' },
          input: { type: 'text', max_length: 50 } },
      ],
    },
  ],
}
```

提交后原卡片替换为：
- 成功：`✅ 已补录：《{title}》（讲师 {instructor}）— [去 AI 岛查看]`
- 失败：`❌ 补录失败：{err.message}` + 重新填写的入口按钮

---

## 7. 飞书回调协议

### 7.1 收到的事件

```json
{
  "schema": "2.0",
  "header": {
    "event_type": "card.action.trigger",
    "tenant_key": "abc123",
    "app_id": "cli_xxx",
    "open_id": "ou_xxx",
    "message_id": "om_xxx"
  },
  "event": {
    "operator": { "open_id": "ou_xxx" },
    "action": {
      "tag": "form_submit",
      "name": "course_form",
      "form_value": {
        "title": "...", "instructor": "...", "content_type": "video",
        "published_at": "2026-06-08",
        "courseware_url": "...", "video_url": "...", "period": "第 12 期"
      },
      "message_id": "om_xxx"
    }
  }
}
```

### 7.2 处理

```ts
// src/app/api/feishu/card-callback/route.ts
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const body = JSON.parse(raw);
  const header = body.header ?? {};
  const event = body.event ?? {};

  // 1. URL 验证握手
  if (header.event_type === 'url_verification' || body.type === 'url_verification') {
    return NextResponse.json({ challenge: body.challenge });
  }

  // 2. 验签 + 解密
  const decrypted = await verifyAndDecryptCardEvent(raw, header.tenant_key);
  if (!decrypted) return NextResponse.json({ error: 'verify failed' }, { status: 401 });

  // 3. 路由
  if (header.event_type === 'card.action.trigger'
      && event.action?.tag === 'form_submit'
      && event.action?.name === 'course_form') {
    await handleCourseCardSubmit(event.action.form_value, event.action.message_id, header.open_id);
  }

  return NextResponse.json({ ok: true });
}
```

### 7.3 替换原卡片

```ts
// src/lib/feishu-message.ts
export async function replaceFeishuCard(messageId: string, card: object): Promise<{ ok: boolean; error?: string }> {
  const token = await getTenantAccessToken();
  const res = await fetch(`${FEISHU_API_BASE}/im/v1/messages/${messageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ msg_type: 'interactive', content: JSON.stringify(card) }),
  });
  const data = await res.json();
  return data.code === 0 ? { ok: true } : { ok: false, error: data.msg };
}
```

---

## 8. 错误处理

| 失败点 | 行为 |
|--------|------|
| CRON_SECRET 不匹配 | 401 + 不入 logs |
| `feishu_apps.encrypt_key` 为空 | 401 + 错误日志（admin 应去补） |
| 验签失败 / 解密失败 | 401 + console.error 完整 payload（无新表） |
| 卡片缺必填 | 原卡片替换为"❌ 提交失败：必填字段" |
| `insertCourseRow` DB 错误 | 原卡片替换为"❌ 写入失败：{err}"，reminder_logs 不算成功 |
| 飞书 POST messages 失败 | reminder_logs.status=failed；next_send_at 仍推进 |
| 飞书 PATCH message 失败 | 不阻塞业务，记 error log |
| 同一卡片重复触发 | 仅去重 1 分钟（reminder_logs 已有）；不阻断，因为每次 message_id 不同 |

---

## 9. 端到端验证脚本

1. **准备**：
   - 飞书开放平台 → 事件订阅 → 设置 callback URL = `https://hras-ai-land.vercel.app/api/feishu/card-callback`
   - 复制 Encrypt Key → 填到 feishu_apps 行
   - 跑 migration 025

2. **手动触发 cron**：
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
        https://hras-ai-land.vercel.app/api/cron/weekly-course-card
   ```
   预期：所有 course_admin 收到卡片，reminder_logs 新增 N 条

3. **填表提交**：
   - 在飞书客户端填卡片 → 提交
   - 检查 /courses 列表第一行就是新数据
   - 原卡片应变成"✅ 已补录"

4. **失败用例**：
   - 故意漏填 title → 卡片变"❌ 提交失败"
   - 故意把 feishu_apps.encrypt_key 删掉 → 回调 401，新数据不写入
   - 故意把 feishu_apps 行删掉 → 同上

5. **中文名确认**：
   - /admin/users → 角色 select 选项里能看到"AI 课程管理员"
   - 代码 grep `公开管理员` 应只剩注释 / 文档

---

## 10. 已知 follow-up（不在本次范围）

1. 飞书多租户卡片回调（每个 enterprise 自己的 app 都配 encrypt_key）
2. /courses "新建课程" web 弹窗当前漏 `description` / `duration` / `difficulty` 字段，handler 端用兜底值
3. admin/reminders UI 是否要加 card_template 编辑入口
4. 周二 / 周三补发提醒
5. `reminder-service.ts` 现用 single-tenant token，与 8 个 shim 一起下一轮改造

---

## 11. 回滚

- migration 025 可反向（ALTER TABLE ... DROP COLUMN + DELETE 种子）
- vercel.json 删一行
- 新增文件按 git revert 处理
- 角色更名通过 git revert 即可（DB key 未改）
