/**
 * 飞书消息卡片模板构建器
 * 公开课卡片参照 docs/feishu-bot-card.json 模板
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hras-ai-land.vercel.app';

/** 截取文本 */
function truncate(text: string, maxLen: number): string {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

/** 格式化日期 */
function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/** 公开课卡片 — 参照 feishu-bot-card.json 模板 */
export function buildCourseCard(course: {
  id: string;
  title: string;
  instructor?: string;
  video_url?: string;
  courseware_url?: string;
  created_at?: string;
  period?: string | null;
  cover_image_key?: string | null;
}) {
  const bodyElements: unknown[] = [];

  // ── 海报图片 ──
  if (course.cover_image_key) {
    bodyElements.push({
      tag: 'img',
      img_key: course.cover_image_key,
      alt: { tag: 'plain_text', content: course.title },
      mode: 'fit_horizontal',
    });
  }

  // ── 正文区：column_set (grey-50 背景) ──
  const contentElements: unknown[] = [
    {
      tag: 'markdown',
      content: `**本期内容：** ${course.title}\n**本期讲师：** ${course.instructor || '待定'}`,
      text_align: 'left',
      text_size: 'normal_v2',
      margin: '4px 4px 4px 4px',
    },
    {
      tag: 'hr',
      margin: '0px 0px 0px 0px',
    },
    {
      tag: 'div',
      text: {
        tag: 'plain_text',
        content: `发布日期：${formatDate(course.created_at)}`,
        text_size: 'notation',
        text_align: 'left',
        text_color: 'grey',
      },
      margin: '4px 4px 4px 4px',
    },
  ];

  bodyElements.push({
    tag: 'column_set',
    background_style: 'default',
    horizontal_spacing: '8px',
    horizontal_align: 'left',
    columns: [
      {
        tag: 'column',
        width: 'weighted',
        elements: contentElements,
        vertical_align: 'top',
        weight: 1,
      },
    ],
    margin: '12px 12px 12px 12px',
  });

  // ── 按钮区：3 个等宽按钮 ──
  const buttonColumns: unknown[] = [];

  // 查看录屏（primary_filled）
  if (course.video_url) {
    buttonColumns.push({
      tag: 'column',
      width: 'weighted',
      elements: [
        {
          tag: 'button',
          text: { tag: 'plain_text', content: '查看录屏' },
          type: 'primary_filled',
          width: 'fill',
          size: 'medium',
          icon: { tag: 'standard_icon', token: 'share-computer-audio_outlined' },
          url: course.video_url,
          margin: '0px 0px 0px 0px',
        },
      ],
      vertical_spacing: '8px',
      horizontal_align: 'left',
      vertical_align: 'top',
      weight: 1,
    });
  }

  // 查看课件（primary）
  if (course.courseware_url) {
    buttonColumns.push({
      tag: 'column',
      width: 'weighted',
      elements: [
        {
          tag: 'button',
          text: { tag: 'plain_text', content: '查看课件' },
          type: 'primary',
          width: 'fill',
          size: 'medium',
          icon: { tag: 'standard_icon', token: 'describe_outlined' },
          url: course.courseware_url,
          margin: '0px 0px 0px 0px',
        },
      ],
      vertical_spacing: '8px',
      horizontal_align: 'left',
      vertical_align: 'top',
      weight: 1,
    });
  }

  // 查看往期（default）
  buttonColumns.push({
    tag: 'column',
    width: 'weighted',
    elements: [
      {
        tag: 'button',
        text: { tag: 'plain_text', content: '查看往期' },
        type: 'default',
        width: 'fill',
        size: 'medium',
        icon: { tag: 'standard_icon', token: 'history-search_outlined' },
        url: `${APP_URL}/courses`,
        margin: '0px 0px 0px 0px',
      },
    ],
    vertical_align: 'top',
    weight: 1,
  });

  bodyElements.push({
    tag: 'column_set',
    horizontal_spacing: '8px',
    horizontal_align: 'left',
    columns: buttonColumns,
    margin: '8px 20px 12px 20px',
  });

  return {
    schema: '2.0',
    config: {
      update_multi: true,
      style: {
        text_size: {
          normal_v2: {
            default: 'normal',
            pc: 'normal',
            mobile: 'heading',
          },
        },
      },
    },
    header: {
      title: { tag: 'plain_text', content: 'AI公开课上新！' },
      subtitle: { tag: 'plain_text', content: 'HRAS AI公开课，体系化带你从AI工具上手到落地' },
      text_tag_list: [
        { tag: 'text_tag', text: { tag: 'plain_text', content: 'AI公开课' }, color: 'turquoise' },
        ...(course.period ? [{ tag: 'text_tag' as const, text: { tag: 'plain_text' as const, content: course.period }, color: 'blue' as const }] : []),
      ],
      template: 'turquoise',
      icon: { tag: 'standard_icon', token: 'collection_outlined' },
      padding: '12px 8px 12px 8px',
    },
    body: {
      direction: 'vertical',
      horizontal_spacing: '8px',
      vertical_spacing: '0px',
      horizontal_align: 'left',
      vertical_align: 'top',
      padding: '0px 0px 0px 0px',
      elements: bodyElements,
    },
  };
}

/** 工具推荐卡片 */
export function buildResourceCard(resource: {
  id: string;
  name: string;
  category?: string;
  description?: string;
  official_url?: string;
  logo?: string;
}) {
  const bodyElements: unknown[] = [];

  // ── Logo 图片 ──
  if (resource.logo) {
    bodyElements.push({
      tag: 'img',
      img_key: resource.logo, // 可能是 Supabase URL，卡片不一定支持
      alt: { tag: 'plain_text', content: resource.name },
      mode: 'fit_horizontal',
    });
  }

  // ── 正文区 ──
  const contentElements: unknown[] = [
    {
      tag: 'markdown',
      content: `**工具名称：** ${resource.name}\n**适用场景：** ${resource.category || '通用'}\n\n${truncate(resource.description || '', 150)}`,
      text_align: 'left',
      text_size: 'normal_v2',
      margin: '4px 4px 4px 4px',
    },
  ];

  bodyElements.push({
    tag: 'column_set',
    background_style: 'default',
    horizontal_spacing: '8px',
    horizontal_align: 'left',
    columns: [
      {
        tag: 'column',
        width: 'weighted',
        elements: contentElements,
        vertical_align: 'top',
        weight: 1,
      },
    ],
    margin: '12px 12px 12px 12px',
  });

  // ── 按钮区 ──
  const buttonColumns: unknown[] = [];

  if (resource.official_url) {
    buttonColumns.push({
      tag: 'column',
      width: 'weighted',
      elements: [
        {
          tag: 'button',
          text: { tag: 'plain_text', content: '🔗 访问官网' },
          type: 'primary_filled',
          width: 'fill',
          size: 'medium',
          icon: { tag: 'standard_icon', token: 'link_outlined' },
          url: resource.official_url,
          margin: '0px 0px 0px 0px',
        },
      ],
      vertical_spacing: '8px',
      horizontal_align: 'left',
      vertical_align: 'top',
      weight: 1,
    });
  }

  buttonColumns.push({
    tag: 'column',
    width: 'weighted',
    elements: [
      {
        tag: 'button',
        text: { tag: 'plain_text', content: '📚 查看更多' },
        type: 'default',
        width: 'fill',
        size: 'medium',
        icon: { tag: 'standard_icon', token: 'appstore_outlined' },
        url: `${APP_URL}/apps`,
        margin: '0px 0px 0px 0px',
      },
    ],
    vertical_align: 'top',
    weight: 1,
  });

  bodyElements.push({
    tag: 'column_set',
    horizontal_spacing: '8px',
    horizontal_align: 'left',
    columns: buttonColumns,
    margin: '8px 20px 12px 20px',
  });

  return {
    schema: '2.0',
    config: {
      update_multi: true,
      style: {
        text_size: {
          normal_v2: {
            default: 'normal',
            pc: 'normal',
            mobile: 'heading',
          },
        },
      },
    },
    header: {
      title: { tag: 'plain_text', content: '🛠️ 新工具推荐' },
      subtitle: { tag: 'plain_text', content: 'HRAS AI精选工具，助你高效办公' },
      text_tag_list: [
        { tag: 'text_tag', text: { tag: 'plain_text', content: '工具推荐' }, color: 'green' },
        ...(resource.category ? [{ tag: 'text_tag' as const, text: { tag: 'plain_text' as const, content: resource.category }, color: 'blue' as const }] : []),
      ],
      template: 'green',
      icon: { tag: 'standard_icon', token: 'appstore_outlined' },
      padding: '12px 8px 12px 8px',
    },
    body: {
      direction: 'vertical',
      horizontal_spacing: '8px',
      vertical_spacing: '0px',
      horizontal_align: 'left',
      vertical_align: 'top',
      padding: '0px 0px 0px 0px',
      elements: bodyElements,
    },
  };
}

/** 案例卡片 */
export function buildCaseCard(c: {
  id: string;
  title: string;
  author?: string;
  category?: string;
  summary?: string;
  like_count?: number;
  comment_count?: number;
}) {
  const lines: string[] = [];
  lines.push(`**${c.title}**`);
  const meta: string[] = [];
  if (c.author) meta.push(`👤 ${c.author}`);
  if (c.category) meta.push(`🏷️ ${c.category}`);
  if (meta.length) lines.push(meta.join('　　'));
  if (c.summary) lines.push('', truncate(c.summary, 120));
  if (c.like_count || c.comment_count) {
    lines.push('', `👍 ${c.like_count ?? 0}　💬 ${c.comment_count ?? 0}`);
  }

  return {
    schema: '2.0',
    config: { update_multi: true },
    header: {
      title: { tag: 'plain_text', content: '📚 新案例推荐' },
      template: 'violet',
    },
    body: {
      direction: 'vertical',
      elements: [
        { tag: 'markdown', content: lines.join('\n') },
        { tag: 'hr' },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '🔍 查看详情' },
              type: 'primary',
              url: `${APP_URL}/cases/${c.id}`,
            },
          ],
        },
      ],
    },
  };
}

/** 大赛方案卡片 */
export function buildSubmissionCard(s: {
  id: string;
  title: string;
  submitter?: string;
  track?: string;
  afterProcess?: string;
}) {
  const lines: string[] = [];
  lines.push(`**${s.title}**`);
  const meta: string[] = [];
  if (s.submitter) meta.push(`👤 ${s.submitter}`);
  if (s.track) meta.push(`🏁 ${s.track}`);
  if (meta.length) lines.push(meta.join('　　'));
  if (s.afterProcess) lines.push('', truncate(s.afterProcess, 120));

  return {
    schema: '2.0',
    config: { update_multi: true },
    header: {
      title: { tag: 'plain_text', content: '📋 大赛方案速览' },
      template: 'orange',
    },
    body: {
      direction: 'vertical',
      elements: [
        { tag: 'markdown', content: lines.join('\n') },
        { tag: 'hr' },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '📋 查看方案' },
              type: 'primary',
              url: `${APP_URL}/competitions/${s.id}`,
            },
          ],
        },
      ],
    },
  };
}
