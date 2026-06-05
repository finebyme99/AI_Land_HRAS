import type { CaseCategory, ResourceCategory, CourseDifficulty, ContentType, EventStatus, CaseTeam, CaseBusinessScenario } from '@/types';
import { RESOURCE_CATEGORIES } from '@/types';

/**
 * 硬编码评委名单（临时方案）
 *
 * 背景：飞书多维表格里 GUS HRBP 考勤签字报表的"方案确认用户"（薛佳玥 Hailey / 郭谦）
 * 在 users 表里没有 reviewer 角色，导致在前台看不到方案评审入口。
 *
 * TODO：后续方案 — 改用 admin/users 后台加角色；或在 AI 大赛同步流程里自动从
 * 飞书"确认用户"字段回填 reviewer 角色到 users.roles。
 * 见 CLAUDE.md 跟进项。
 */
export const HARDCODED_REVIEWER_NAMES: string[] = [
  'JIAYUEXUE',
  '薛佳玥',
  '郭谦',
  '章佳媛',
];

/**
 * 硬编码方案级评委分配（临时方案）
 *
 * 用途：当一个具体人需要评审某个具体方案，但飞书多维表格的 reviewers 字段
 * 没把这个名字填进去。用 userName → 方案名数组 的映射做前端过滤放行。
 *
 * 匹配规则：submission.title 包含（includes）任一目标字符串即视为命中。
 *
 * TODO：后续从飞书 reviewers 字段同步到 submissions.reviewers 字段。
 */
export const HARDCODED_REVIEWER_PROPOSALS: Record<string, string[]> = {
  '章佳媛': ['AI员工关怀物料设计流程'],
};

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
  'AI Agent/大模型': 'blue',
  '好用 Skills': 'purple',
};

/** 获取所有资源分类 */
export function getAllCategories(): ResourceCategory[] {
  return RESOURCE_CATEGORIES;
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

// 提报团队
export const CASE_TEAMS: CaseTeam[] = ['LBU', 'FBU', 'ABU', 'HQU', 'WX', 'GEU', 'GUS', 'ZT_HSSC', 'GF_HSSC', 'ZT_ASSC', 'GF_ASSC'];
export const CASE_TEAM_OPTIONS = CASE_TEAMS.map((t) => ({ label: t, value: t }));

// 业务场景
export const CASE_BUSINESS_SCENARIOS: CaseBusinessScenario[] = [
  '数据分析', '招聘管理', '薪酬绩效', '培训管理', '组织与人才发展',
  '文化氛围', '核算与报账', '基础人事支持', '行政管理', '日常工作', '考勤管理', '其他',
];
export const CASE_BUSINESS_SCENARIO_OPTIONS = CASE_BUSINESS_SCENARIOS.map((s) => ({ label: s, value: s }));

// 原核心痛点
export const PAIN_POINTS = [
  '重复劳动，机械操作太多',
  '涉及多个系统，来回切换',
  '数据整理/清洗耗时巨大',
  '容易出错，反复核对',
  '跨部门协调沟通成本高',
  '需要等别人/等审批，被卡住',
  '格式/模板要求繁琐',
  '知识经验难以沉淀和复用',
];
export const PAIN_POINT_OPTIONS = PAIN_POINTS.map((p) => ({ label: p, value: p }));

// 其他价值补充（非必填）
export const OTHER_VALUES = ['准确率提升', '质量提升', '员工体验提升'];
export const OTHER_VALUE_OPTIONS = OTHER_VALUES.map((v) => ({ label: v, value: v }));

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
