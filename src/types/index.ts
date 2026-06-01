// ============ 用户 ============
export interface User {
  id: string;
  feishu_open_id: string;
  name: string;
  avatar: string;
  department: string;
  roles: string[];
  bio: string;
  points: number;
  level: 'AI新手' | 'AI探索者' | 'AI达人' | 'AI专家';
  created_at: string;
}

// ============ 案例 ============
export type CaseCategory =
  | 'HRAS_人力数据看板'
  | 'HSSC_招聘'
  | 'HCOE/HSSC_薪酬绩效'
  | 'HCOE_培训'
  | 'HCOE/HSSC_组织与人才发展'
  | 'HCOE_文化氛围'
  | 'HSSC_核算与报账'
  | 'HSSC_基础人事支持'
  | 'ASSC_行政管理'
  | '其他';

export type ContentStatus = 'draft' | 'pending' | 'published' | 'rejected';

export type CaseTeam = 'LBU' | 'FBU' | 'ABU' | 'HQU' | 'WX' | 'GEU' | 'GUS' | 'ZT_HSSC' | 'GF_HSSC' | 'ZT_ASSC' | 'GF_ASSC';

export type CaseBusinessScenario =
  | '数据分析'
  | '招聘管理'
  | '薪酬绩效'
  | '培训管理'
  | '组织与人才发展'
  | '文化氛围'
  | '核算与报账'
  | '基础人事支持'
  | '行政管理'
  | '日常工作'
  | '考勤管理'
  | '其他';

export interface Case {
  id: string;
  title: string;
  summary: string;
  content: string;
  cover_image: string;
  category: CaseCategory;
  ai_tools: string[];
  attachments: string[];
  author: Pick<User, 'id' | 'name' | 'avatar' | 'department'>;
  status: ContentStatus;
  view_count: number;
  like_count: number;
  bookmark_count: number;
  comment_count: number;
  event_id: string | null;
  is_featured?: boolean;
  team?: CaseTeam | '';
  business_scenario?: CaseBusinessScenario | '';
  created_at: string;
  updated_at: string;
}

// ============ 资源推荐 ============
export type ResourceType = 'ai_tool' | 'guide' | 'skill';

export type AIToolCategory = '对话类' | '写作类' | '设计类' | '数据分析' | '自动化' | 'HR专属';
export type GuideCategory = '入门指引' | '场景实操' | '进阶技巧' | '最佳实践';
export type SkillCategory = '效率提升' | '数据分析' | '内容创作' | '流程自动化' | 'HR专用';

export type ResourceCategory = AIToolCategory | GuideCategory | SkillCategory;

/** 资源分类按类型分组 */
export const RESOURCE_CATEGORIES: Record<ResourceType, ResourceCategory[]> = {
  ai_tool: ['对话类', '写作类', '设计类', '数据分析', '自动化', 'HR专属'],
  guide: ['入门指引', '场景实操', '进阶技巧', '最佳实践'],
  skill: ['效率提升', '数据分析', '内容创作', '流程自动化', 'HR专用'],
};

export interface Resource {
  id: string;
  resource_type: ResourceType;
  name: string;
  logo: string;
  description: string;
  content: string;
  category: ResourceCategory;
  scenarios: string[];
  official_url: string;
  rating: number;
  user_count: number;
  like_count: number;
  dislike_count: number;
  is_featured?: boolean;
  status: ContentStatus;
  author_id: string | null;
  created_at: string;
}

/** @deprecated 兼容旧代码，等同于 Resource */
export type AppRecommendation = Resource;

// ============ 课程 ============
export type CourseDifficulty = '初阶' | '进阶' | '高阶';
export type ContentType = 'video' | 'doc';

export interface Course {
  id: string;
  title: string;
  description: string;
  cover_image: string;
  instructor: string;
  difficulty: CourseDifficulty;
  duration: string;
  content_type: ContentType | ContentType[];
  courseware_url: string;
  video_url: string;
  chapters: CourseChapter[];
  student_count: number;
  rating: number;
  like_count: number;
  bookmark_count: number;
  comment_count: number;
  is_featured?: boolean;
  created_at: string;
}

export interface CourseChapter {
  id: string;
  title: string;
  content_url: string;
  content: string;
  duration: string;
  sort_order: number;
}

export interface LearningRecord {
  id: string;
  user_id: string;
  course_id: string;
  chapter_id: string;
  progress: number;
  completed_at: string | null;
}

// ============ 活动（AI 大赛） ============
export type EventStatus = 'upcoming' | 'ongoing' | 'ended';

export interface Event {
  id: string;
  title: string;
  description: string;
  cover_image: string;
  rules: string;
  prizes: string;
  start_time: string;
  end_time: string;
  registration_deadline: string;
  status: EventStatus;
  registration_count: number;
  max_participants: number;
  created_at: string;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  user_id: string;
  registered_at: string;
}

export interface EventSubmission {
  id: string;
  event_id: string;
  user: Pick<User, 'id' | 'name' | 'avatar'>;
  title: string;
  content: string;
  file_url: string;
  score: number | null;
  rank: number | null;
  submitted_at: string;
}

// ============ 评审 ============
export type ReviewDecision = 'approved' | 'rejected' | 'reviewed';
export type ReviewerRole = 'user' | 'business' | 'tech';

/** 评审评分维度（8维） */
export interface ReviewScores {
  scenario?: number;        // 场景明确性（用户评委 ×1.5）
  painPoint?: number;       // 痛点真实性（用户评委 ×1.2）
  effectiveness?: number;   // 产品实用性（用户评委 ×1.2）
  replicability?: number;   // 可复用性（业务评委 ×1.5）
  dataReliability?: number; // 数据详实度（业务评委 ×1.2）
  breakthrough?: number;    // 突破开创性（业务评委 ×1.2）
  techUsability?: number;   // 技术可用性（技术评委 ×1.2）
  toolFit?: number;         // 工具合理性（技术评委 ×1.0）
}

/** 评分维度配置 */
export interface ScoreDimension {
  key: keyof ReviewScores;
  label: string;
  weight: number;
  highSignal: string;
  lowSignal: string;
}

/** 各角色对应的评分维度 */
export const SCORE_DIMENSIONS: Record<ReviewerRole, ScoreDimension[]> = {
  user: [
    { key: 'scenario', label: '场景明确性', weight: 1.5, highSignal: '场景高频刚需、描述清晰完整', lowSignal: '场景模糊或低频，描述不清' },
    { key: 'painPoint', label: '痛点真实性', weight: 1.2, highSignal: '场景高频，大家普遍反馈痛', lowSignal: '低频场景，或已有成熟解决方案' },
    { key: 'effectiveness', label: '产品实用性', weight: 1.2, highSignal: '显著提效/显著增值/解决长期痛点', lowSignal: '和用之前差不多，甚至更复杂' },
  ],
  business: [
    { key: 'replicability', label: '可复用性', weight: 1.5, highSignal: '覆盖面广、涉及多团队、或有战略价值', lowSignal: '影响范围极窄，依赖个人/仅个别人受益' },
    { key: 'dataReliability', label: '数据详实度', weight: 1.2, highSignal: '量化数据可信/符合真实业务场景', lowSignal: '量化数据矛盾/不符合真实场景' },
    { key: 'breakthrough', label: '突破开创性', weight: 1.2, highSignal: '之前没有此能力，达成了流程首创或再造', lowSignal: '无任何流程再造、突破创新' },
  ],
  tech: [
    { key: 'techUsability', label: '技术可用性', weight: 1.2, highSignal: '有高度标准可用的SOP/SKILLS/代码仓库', lowSignal: '存在技术隐患/疑点，不具备技术可行性' },
    { key: 'toolFit', label: '工具合理性', weight: 1.0, highSignal: 'AI工具匹配场景，选型有依据', lowSignal: '工具和场景明显不匹配' },
  ],
};

export interface CompetitionReview {
  id: string;
  submission_id: string;
  proposal_no: number | null;
  title: string;
  reviewer_id: string;
  reviewer?: Pick<User, 'id' | 'name' | 'avatar' | 'department'>;
  decision: ReviewDecision;
  is_benchmark: boolean;
  reason: string;
  scores: ReviewScores;
  reviewer_role: ReviewerRole | null;
  created_at: string;
  updated_at: string;
}

// ============ 通用 ============
export interface Comment {
  id: string;
  target_type: 'case' | 'course' | 'answer' | 'app';
  target_id: string;
  content: string;
  author: Pick<User, 'id' | 'name' | 'avatar'>;
  parent_id: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  type: 'comment' | 'like' | 'answer' | 'event' | 'system';
  title: string;
  content: string;
  target_type: string;
  target_id: string;
  is_read: boolean;
  created_at: string;
}

/** 计算加权总分 */
export function computeWeightedScore(scores: ReviewScores, role: ReviewerRole): number {
  const dims = SCORE_DIMENSIONS[role];
  if (!dims) return 0;
  return dims.reduce((sum, dim) => {
    const val = scores[dim.key];
    return sum + (val != null ? val * dim.weight : 0);
  }, 0);
}
