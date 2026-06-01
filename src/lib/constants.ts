import type { CaseCategory, ResourceCategory, ResourceType, CourseDifficulty, ContentType, EventStatus, CaseTeam, CaseBusinessScenario } from '@/types';
import { RESOURCE_CATEGORIES } from '@/types';

// HR 模块分类颜色映射
export const CATEGORY_COLORS: Record<CaseCategory, string> = {
  'HRAS_人力数据看板': 'blue',
  'HSSC_招聘': 'cyan',
  'HCOE/HSSC_薪酬绩效': 'orange',
  'HCOE_培训': 'green',
  'HCOE/HSSC_组织与人才发展': 'purple',
  'HCOE_文化氛围': 'magenta',
  'HSSC_核算与报账': 'gold',
  'HSSC_基础人事支持': 'lime',
  'ASSC_行政管理': 'geekblue',
  '其他': 'default',
};

/** 资源分类颜色映射 */
export const RESOURCE_CATEGORY_COLORS: Record<ResourceCategory, string> = {
  // AI 工具
  '对话类': 'blue',
  '写作类': 'green',
  '设计类': 'purple',
  '数据分析': 'orange',
  '自动化': 'cyan',
  'HR专属': 'magenta',
  // 操作指引
  '入门指引': 'geekblue',
  '场景实操': 'lime',
  '进阶技巧': 'gold',
  '最佳实践': 'volcano',
  // Skills
  '效率提升': 'blue',
  '内容创作': 'green',
  '流程自动化': 'cyan',
  'HR专用': 'magenta',
};

/** @deprecated 兼容旧代码 */
export const APP_CATEGORY_COLORS = RESOURCE_CATEGORY_COLORS;

/** 资源类型 Tab 配置 */
export const RESOURCE_TYPE_TABS: { key: ResourceType; label: string }[] = [
  { key: 'ai_tool', label: 'AI 工具' },
  { key: 'guide', label: '操作指引' },
  { key: 'skill', label: 'Skills' },
];

/** 获取指定资源类型的分类列表 */
export function getResourceCategories(type: ResourceType): ResourceCategory[] {
  return RESOURCE_CATEGORIES[type] ?? [];
}

export const DIFFICULTY_OPTIONS = [
  { label: '初阶', value: '初阶' as CourseDifficulty },
  { label: '进阶', value: '进阶' as CourseDifficulty },
  { label: '高阶', value: '高阶' as CourseDifficulty },
];

export const CONTENT_TYPE_OPTIONS = [
  { label: '视频', value: 'video' as ContentType },
  { label: '文档', value: 'doc' as ContentType },
];

export const CASE_CATEGORIES: CaseCategory[] = [
  'HRAS_人力数据看板',
  'HSSC_招聘',
  'HCOE/HSSC_薪酬绩效',
  'HCOE_培训',
  'HCOE/HSSC_组织与人才发展',
  'HCOE_文化氛围',
  'HSSC_核算与报账',
  'HSSC_基础人事支持',
  'ASSC_行政管理',
  '其他',
];

export const CASE_CATEGORY_OPTIONS = CASE_CATEGORIES.map((c) => ({ label: c, value: c }));

// 常用 AI 工具
export const AI_TOOL_OPTIONS = [
  { label: 'ChatGPT / Codex', value: 'ChatGPT/Codex' },
  { label: 'Claude / Claude Code', value: 'Claude/Claude Code' },
  { label: 'DeepSeek', value: 'DeepSeek' },
  { label: 'Gemini', value: 'Gemini' },
  { label: 'GLM', value: 'GLM' },
  { label: 'Kimi', value: 'Kimi' },
  { label: 'Mimo / MimoClaw', value: 'Mimo/MimoClaw' },
  { label: 'MiniMax', value: 'MiniMax' },
  { label: 'Qwen', value: 'Qwen' },
  { label: 'Trae', value: 'Trae' },
  { label: 'Workbuddy / Codebuddy', value: 'Workbuddy/Codebuddy' },
  { label: '其他（请补充）', value: '其他' },
];

/** @deprecated 兼容旧代码 */
export const APP_CATEGORIES = RESOURCE_CATEGORIES.ai_tool;

// 提报团队
export const CASE_TEAMS: CaseTeam[] = ['LBU', 'FBU', 'ABU', 'HQU', 'WX', 'GEU', 'GUS', 'ZT_HSSC', 'GF_HSSC', 'ZT_ASSC', 'GF_ASSC'];
export const CASE_TEAM_OPTIONS = CASE_TEAMS.map((t) => ({ label: t, value: t }));

// 业务场景
export const CASE_BUSINESS_SCENARIOS: CaseBusinessScenario[] = [
  '数据分析', '招聘管理', '薪酬绩效', '培训管理', '组织与人才发展',
  '文化氛围', '核算与报账', '基础人事支持', '行政管理', '日常工作', '考勤管理', '其他',
];
export const CASE_BUSINESS_SCENARIO_OPTIONS = CASE_BUSINESS_SCENARIOS.map((s) => ({ label: s, value: s }));

export const EVENT_STATUS_MAP: Record<EventStatus, { label: string; color: string }> = {
  upcoming: { label: '即将开始', color: 'blue' },
  ongoing: { label: '进行中', color: 'red' },
  ended: { label: '已结束', color: 'default' },
};

export const COURSE_DIFFICULTY_COLORS: Record<CourseDifficulty, string> = {
  '初阶': 'green',
  '进阶': 'blue',
  '高阶': 'orange',
};
