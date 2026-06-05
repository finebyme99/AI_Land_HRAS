-- A. feishu_apps 加 encrypt_key（卡片回调验签/解密用）
ALTER TABLE feishu_apps ADD COLUMN IF NOT EXISTS encrypt_key text;
COMMENT ON COLUMN feishu_apps.encrypt_key IS '飞书事件订阅的 Encrypt Key，用于解密卡片回调 payload';

-- B. 种子提醒：周一 18:25 weekly
--    card_template 直接存卡片 JSON；reminder-service 看到非空就发卡片
INSERT INTO reminders (id, title, content, frequency, send_time, send_day, is_active, card_template, next_send_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-0000000a0001'::uuid,
  '📚 补录本周 AI 公开课',
  '',
  'weekly',
  '18:25',
  1,
  true,
  -- 完整卡片 JSON 写在 build_course_input_card.sql 视图后单独导入
  jsonb_build_object(
    'config', jsonb_build_object('wide_screen_mode', true),
    'header', jsonb_build_object(
      'title', jsonb_build_object('tag', 'plain_text', 'content', '📚 补录本周 AI 公开课'),
      'template', 'orange'
    ),
    'elements', jsonb_build_array(
      jsonb_build_object('tag', 'div', 'text', jsonb_build_object('tag', 'lark_md', 'content', '请在 **本周公开课结束** 后填写，提交后立即同步到 AI 岛。')),
      jsonb_build_object('tag', 'hr'),
      jsonb_build_object('tag', 'form', 'name', 'course_form', 'elements', jsonb_build_array(
        jsonb_build_object('tag', 'input', 'name', 'title', 'label', jsonb_build_object('tag', 'plain_text', 'content', '课程标题 *'), 'placeholder', jsonb_build_object('tag', 'plain_text', 'content', '例：用 Claude Code 写周报'), 'input', jsonb_build_object('type', 'text', 'max_length', 100)),
        jsonb_build_object('tag', 'input', 'name', 'instructor', 'label', jsonb_build_object('tag', 'plain_text', 'content', '讲师 *'), 'input', jsonb_build_object('type', 'text')),
        jsonb_build_object('tag', 'select_static', 'name', 'content_type', 'label', jsonb_build_object('tag', 'plain_text', 'content', '内容形式 *'), 'options', jsonb_build_array(jsonb_build_array('video', '视频'), jsonb_build_array('doc', '文档'))),
        jsonb_build_object('tag', 'date_picker', 'name', 'published_at', 'label', jsonb_build_object('tag', 'plain_text', 'content', '开课日期'), 'date_picker', jsonb_build_object('type', 'date')),
        jsonb_build_object('tag', 'input', 'name', 'cover_image', 'label', jsonb_build_object('tag', 'plain_text', 'content', '封面图 URL'), 'input', jsonb_build_object('type', 'text')),
        jsonb_build_object('tag', 'input', 'name', 'courseware_url', 'label', jsonb_build_object('tag', 'plain_text', 'content', '课件链接'), 'input', jsonb_build_object('type', 'text')),
        jsonb_build_object('tag', 'input', 'name', 'video_url', 'label', jsonb_build_object('tag', 'plain_text', 'content', '视频链接'), 'input', jsonb_build_object('type', 'text')),
        jsonb_build_object('tag', 'input', 'name', 'period', 'label', jsonb_build_object('tag', 'plain_text', 'content', '期数（如：第 12 期）'), 'input', jsonb_build_object('type', 'text', 'max_length', 50))
      ))
    )
  ),
  -- 下个周一 10:25 UTC
  date_trunc('day', (now() AT TIME ZONE 'UTC')::timestamp)
    + (CASE WHEN EXTRACT(DOW FROM (now() AT TIME ZONE 'UTC')::timestamp)::int = 0 THEN 1
            WHEN EXTRACT(DOW FROM (now() AT TIME ZONE 'UTC')::timestamp)::int = 1
                 AND (now() AT TIME ZONE 'UTC')::time < '10:25:00'::time THEN 0
            ELSE 8 - EXTRACT(DOW FROM (now() AT TIME ZONE 'UTC')::timestamp)::int
       END) * interval '1 day'
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
