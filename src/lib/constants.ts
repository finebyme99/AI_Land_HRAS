import type { CaseCategory, AppCategory, CourseCategory, DifficultyLevel, ContentType, EventStatus } from '@/types';

// 分类颜色映射
export const CATEGORY_COLORS: Record<CaseCategory, string> = {
  '招聘': 'blue',
  '培训': 'green',
  '绩效': 'orange',
  '薪酬': 'purple',
  '员工关系': 'cyan',
  '组织发展': 'magenta',
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
  { label: '入门', value: '入门' as DifficultyLevel },
  { label: '基础', value: '基础' as DifficultyLevel },
  { label: '进阶', value: '进阶' as DifficultyLevel },
];

export const CONTENT_TYPE_OPTIONS = [
  { label: '视频', value: 'video' as ContentType },
  { label: '文档', value: 'doc' as ContentType },
];

export const CASE_CATEGORIES: CaseCategory[] = ['招聘', '培训', '绩效', '薪酬', '员工关系', '组织发展'];
export const APP_CATEGORIES: AppCategory[] = ['对话类', '写作类', '设计类', '数据分析', '自动化', 'HR专属'];

export const EVENT_STATUS_MAP: Record<EventStatus, { label: string; color: string }> = {
  upcoming: { label: '即将开始', color: 'blue' },
  ongoing: { label: '进行中', color: 'red' },
  ended: { label: '已结束', color: 'default' },
};

// 难度颜色
export const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  '入门': 'green',
  '基础': 'blue',
  '进阶': 'orange',
};
