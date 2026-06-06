// src/lib/feishu-card-templates.ts
// 飞书卡片预设模板
// 集中维护，避免在 SQL / TS / UI 三处拷贝 JSON

export interface FeishuCardTemplate {
  id: string;
  name: string;
  description: string;
  json: object;
}

/** AI 公开课补录：飞书卡片上点按钮 → 跳 AI 岛 /courses/create
 *  为什么不直接 inline form：飞书对 inline form 渲染跨端不稳（手机/桌面/网页差异大），
 *  改用按钮链接复用已有 web 表单，最稳 */
export const COURSE_INPUT_CARD_TEMPLATE: FeishuCardTemplate = {
  id: 'course_input_v1',
  name: 'AI 公开课补录（按钮链接版）',
  description: '卡片上点按钮跳 AI 岛 /courses/create，提交后写入 courses 表',
  json: {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '📚 补录本周 AI 公开课' },
      template: 'orange',
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: '请在 **本周公开课结束** 后点击下方按钮去 AI 岛填写课程信息，提交后立即出现在课程模块。',
        },
      },
      { tag: 'hr' },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '📝 去 AI 岛填写课程信息' },
            type: 'primary',
            url: 'https://hras-ai-land.vercel.app/courses/create',
          },
        ],
      },
    ],
  },
};

/** 所有可用的卡片模板预设 */
export const FEISHU_CARD_TEMPLATES: FeishuCardTemplate[] = [
  COURSE_INPUT_CARD_TEMPLATE,
];

/** 按 id 找模板，找不到返回 null */
export function getFeishuCardTemplateById(id: string | null | undefined): FeishuCardTemplate | null {
  if (!id) return null;
  return FEISHU_CARD_TEMPLATES.find((t) => t.id === id) ?? null;
}
