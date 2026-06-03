/**
 * 飞书消息卡片模板构建器
 * 统一使用 turquoise 颜色，跳转链接用按钮形式
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hras-ai-land.vercel.app';

/** 截取文本 */
function truncate(text: string, maxLen: number): string {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

/** 公开课卡片 */
export function buildCourseCard(course: {
  id: string;
  title: string;
  instructor?: string;
  difficulty?: string;
  description?: string;
}) {
  const lines: string[] = [];
  lines.push(`**${course.title}**`);
  if (course.instructor) lines.push(`讲师：${course.instructor}`);
  if (course.difficulty) lines.push(`难度：${course.difficulty}`);
  if (course.description) lines.push('', truncate(course.description, 120));

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text' as const, content: `🎓 新课程上线` },
      template: 'turquoise' as const,
    },
    elements: [
      { tag: 'div' as const, text: { tag: 'lark_md' as const, content: lines.join('\n') } },
      { tag: 'hr' as const },
      {
        tag: 'action' as const,
        actions: [
          {
            tag: 'button' as const,
            text: { tag: 'plain_text' as const, content: '📖 查看详情' },
            type: 'primary' as const,
            url: `${APP_URL}/courses/${course.id}`,
          },
        ],
      },
    ],
  };
}

/** 工具推荐卡片（Phase 2） */
export function buildResourceCard(resource: {
  id: string;
  name: string;
  category?: string;
  description?: string;
}) {
  const lines: string[] = [];
  lines.push(`**${resource.name}**`);
  if (resource.category) lines.push(`适用场景：${resource.category}`);
  if (resource.description) lines.push('', truncate(resource.description, 120));

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text' as const, content: `🛠️ 新工具推荐` },
      template: 'turquoise' as const,
    },
    elements: [
      { tag: 'div' as const, text: { tag: 'lark_md' as const, content: lines.join('\n') } },
      { tag: 'hr' as const },
      {
        tag: 'action' as const,
        actions: [
          {
            tag: 'button' as const,
            text: { tag: 'plain_text' as const, content: '🔗 查看详情' },
            type: 'primary' as const,
            url: `${APP_URL}/apps`,
          },
        ],
      },
    ],
  };
}

/** 案例卡片（Phase 2） */
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
  if (c.author) meta.push(`作者：${c.author}`);
  if (c.category) meta.push(`分类：${c.category}`);
  if (meta.length) lines.push(meta.join(' · '));
  if (c.summary) lines.push('', truncate(c.summary, 100));
  if (c.like_count || c.comment_count) {
    lines.push('', `👍 ${c.like_count ?? 0} · 💬 ${c.comment_count ?? 0}`);
  }

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text' as const, content: `📚 新案例推荐` },
      template: 'turquoise' as const,
    },
    elements: [
      { tag: 'div' as const, text: { tag: 'lark_md' as const, content: lines.join('\n') } },
      { tag: 'hr' as const },
      {
        tag: 'action' as const,
        actions: [
          {
            tag: 'button' as const,
            text: { tag: 'plain_text' as const, content: '🔍 查看详情' },
            type: 'primary' as const,
            url: `${APP_URL}/cases/${c.id}`,
          },
        ],
      },
    ],
  };
}

/** 大赛方案卡片（Phase 2） */
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
  if (s.submitter) meta.push(`提交人：${s.submitter}`);
  if (s.track) meta.push(`赛道：${s.track}`);
  if (meta.length) lines.push(meta.join(' · '));
  if (s.afterProcess) lines.push('', truncate(s.afterProcess, 100));

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text' as const, content: `📋 大赛方案速览` },
      template: 'turquoise' as const,
    },
    elements: [
      { tag: 'div' as const, text: { tag: 'lark_md' as const, content: lines.join('\n') } },
      { tag: 'hr' as const },
      {
        tag: 'action' as const,
        actions: [
          {
            tag: 'button' as const,
            text: { tag: 'plain_text' as const, content: '📋 查看方案' },
            type: 'primary' as const,
            url: `${APP_URL}/competitions/${s.id}`,
          },
        ],
      },
    ],
  };
}
