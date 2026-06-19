import type { ResourceCategory, CourseDifficulty, ContentType, EventStatus } from '@/types';
import { RESOURCE_CATEGORIES } from '@/types';

/**
 * 方案级评委别名表（跨语言 name 匹配）
 *
 * 用途：飞书多维表格里方案 reviewers 字段用的是英文名（如 "Claire"），
 * 而本地 users.name 是中文名（如 "章佳媛"）。原来的模糊匹配
 * `i.reviewers.some(r => r.includes(userName) || userName.includes(r))`
 * 跨语言场景会失配，于是用这个表做兜底放行。
 *
 * 匹配规则：submission.title 包含（includes）任一目标字符串即视为命中。
 *
 * TODO：长远方案是给 users 加 aliases: text[] 字段；sync 时从飞书同步别名到该字段；
 * competitions/page.tsx 模糊匹配时合并 name + aliases。
 */
export const HARDCODED_REVIEWER_PROPOSALS: Record<string, string[]> = {
  '章佳媛': ['AI员工关怀物料设计流程'],
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
