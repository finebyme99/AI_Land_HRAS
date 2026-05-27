import type { CaseCategory, AppCategory, CourseCategory, CourseDifficulty, ContentType, EventStatus, CaseTeam, CaseBusinessScenario } from '@/types';

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

export const APP_CATEGORY_COLORS: Record<AppCategory, string> = {
  '对话类': 'blue',
  '写作类': 'green',
  '设计类': 'purple',
  '数据分析': 'orange',
  '自动化': 'cyan',
  'HR专属': 'magenta',
};

export const COURSE_CATEGORY_OPTIONS = [
  { label: 'AI工具基础', value: 'AI工具基础' as CourseCategory },
  { label: 'HR场景实操', value: 'HR场景实操' as CourseCategory },
  { label: 'AI工具进阶', value: 'AI工具进阶' as CourseCategory },
];

export const DIFFICULTY_OPTIONS = [
  { label: '入门', value: '入门' as CourseDifficulty },
  { label: '基础', value: '基础' as CourseDifficulty },
  { label: '进阶', value: '进阶' as CourseDifficulty },
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

export const APP_CATEGORIES: AppCategory[] = ['对话类', '写作类', '设计类', '数据分析', '自动化', 'HR专属'];

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
  '入门': 'green',
  '基础': 'blue',
  '进阶': 'orange',
};
