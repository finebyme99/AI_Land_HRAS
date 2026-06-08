export interface FeishuApp {
  id: string;
  app_id: string;
  app_secret: string;
  tenant_key: string;
  enterprise_name: string;
  redirect_uri: string;
  extra_redirect_uris: string[];
  status: 'active' | 'disabled';
  created_at: string;
  created_by: string | null;
}

export interface AuthLog {
  id: string;
  user_id: string | null;
  app_id: string | null;
  tenant_key: string | null;
  open_id: string | null;
  ip: string | null;
  ua: string | null;
  success: boolean;
  error: string | null;
  created_at: string;
}

// ============ 用户 ============
export interface User {
  id: string;
  feishu_open_id: string;
  feishu_tenant_key?: string | null;
  employee_id?: string | null; // 工号
  username?: string | null;
  name: string;
  avatar: string;
  department: string;
  roles: string[];
  reviewer_roles?: string[]; // 管理员分配的评委角色：user/business/tech
  bio: string;
  points: number;
  level: 'AI新手' | 'AI探索者' | 'AI达人' | 'AI专家';
  created_at: string;
  last_active_at?: string | null;
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
  // 新增字段
  team_members?: string;
  original_business_scenario?: string;
  pain_points?: string[];
  monthly_saved_hours?: number;
  efficiency_ratio?: number;
  demo_link?: string;
  other_values?: string[];
  developers?: Pick<User, 'id' | 'name' | 'avatar' | 'department'>[];
  created_at: string;
  updated_at: string;
}

// ============ 工具推荐 ============
export type ResourceCategory = 'AI Agent/大模型' | '好用 Skills';

export const RESOURCE_CATEGORIES: ResourceCategory[] = ['AI Agent/大模型', '好用 Skills'];

export interface Resource {
  id: string;
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
  author?: { id: string; name: string; avatar: string } | null;
  created_at: string;
  updated_at?: string;
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
  period?: string | null;
  cover_image_key?: string | null;
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
  productEffectiveness?: number; // 产品实用性（用户评委 ×1.5）
  dataConsistency?: number;      // 数据一致性（用户评委 ×1.2）
  productUsability?: number;     // 产品易用性（用户评委 ×1.2）
  replicability?: number;   // 可复用性（业务评委 ×1.5）
  dataReliability?: number; // 数据详实度（业务评委 ×1.2）
  breakthrough?: number;    // 突破开创性（业务评委 ×1.2）
  techDepth?: number;            // 技术实现深度（技术评委 ×1.2）
  engineeringQuality?: number;   // 工程质量与可落地性（技术评委 ×1.0）
}

/** 评分维度配置 */
export interface ScoreDimension {
  key: keyof ReviewScores;
  label: string;
  weight: number;
  highSignal: string;
  lowSignal: string;
  /** 1-5 分完整描述，供评委参考 */
  levels: Record<1 | 2 | 3 | 4 | 5, string>;
}

/** 各角色对应的评分维度 */
export const SCORE_DIMENSIONS: Record<ReviewerRole, ScoreDimension[]> = {
  user: [
    {
      key: 'productEffectiveness', label: '产品实用性', weight: 1.5,
      lowSignal: '和用之前差不多，甚至更复杂',
      highSignal: '效果卓越，提效 80% 以上或实现质的飞跃',
      levels: {
        1: '和用之前差不多，甚至更复杂，没有实质改进',
        2: '有一定改进但幅度有限（提效 <20%），使用仍较繁琐',
        3: '效果明显，提效约 20-50%，日常使用有价值',
        4: '效果显著，提效 50-80%，使用体验好，值得推广',
        5: '效果卓越，提效 80% 以上或实现质的飞跃（从无到有、从小时到分钟）',
      },
    },
    {
      key: 'dataConsistency', label: '数据一致性', weight: 1.2,
      lowSignal: '数据错误或自相矛盾，输出不可信',
      highSignal: '数据高度准确，结果完全可信赖',
      levels: {
        1: '数据明显错误或自相矛盾，输出结果不可信',
        2: '数据部分准确，但存在明显不一致或遗漏',
        3: '数据基本准确一致，偶有小误差但不影响整体判断',
        4: '数据准确一致，有明确的数据来源和校验逻辑',
        5: '数据高度准确，有多维度交叉验证，结果完全可信赖',
      },
    },
    {
      key: 'productUsability', label: '产品易用性', weight: 1.2,
      lowSignal: '操作复杂，学习成本极高',
      highSignal: '操作极其简便，几乎零学习成本',
      levels: {
        1: '操作复杂，需要大量手动步骤，学习成本极高',
        2: '操作较繁琐，需要一定培训才能上手',
        3: '操作基本便捷，有基本的引导说明',
        4: '操作简单直观，有清晰的操作指引，新手可快速上手',
        5: '操作极其简便，几乎零学习成本，体验流畅自然',
      },
    },
  ],
  business: [
    {
      key: 'replicability', label: '可复用性', weight: 1.5,
      lowSignal: '影响范围极窄，依赖个人/仅个别人受益',
      highSignal: '全集团可复用，具有战略价值',
      levels: {
        1: '仅个人受益，无法被他人复用，强依赖个人特定环境或权限',
        2: '个别小型团队可复用，但场景高度特定，推广价值有限',
        3: '一个 BU 团队可复用，场景在该业务线内有通用性',
        4: '2 个及以上 BU 团队可复用，场景跨业务线通用',
        5: '全集团可复用，具有战略价值，可作为标杆案例推广',
      },
    },
    {
      key: 'dataReliability', label: '数据详实度', weight: 1.2,
      lowSignal: '无量化数据，或数据明显编造/不合理',
      highSignal: '数据非常可信，估算依据清晰，有佐证',
      levels: {
        1: '无量化数据，或数据明显编造/不合理（如提效 99%）',
        2: '有量化数据但粗糙笼统，缺少计算依据或对比基准',
        3: '有基本量化数据（工时、人数、频次），数据基本可信',
        4: '数据可信，基于实际业务经验估算，有基本的计算依据（如工时×频次），符合真实工作场景',
        5: '数据非常可信，估算依据清晰（如历史数据对比、实际工时记录），附有系统截图或操作录屏佐证',
      },
    },
    {
      key: 'breakthrough', label: '突破开创性', weight: 1.2,
      lowSignal: '无任何流程再造、突破创新',
      highSignal: '首创性突破，对流程进行底层再造',
      levels: {
        1: '无任何创新，仅是对现有流程的简单复制或手动操作的电子化',
        2: '有微小改进，但本质上是已有方案的变体',
        3: '有一定创新，在已有流程基础上做了有意义的优化或整合',
        4: '有明显突破，实现了之前没有的能力，或对流程进行了实质性再造',
        5: '首创性突破，对整个流程进行了底层再造，或在集团内首次实现该场景的 AI 化，具有标杆意义',
      },
    },
  ],
  tech: [
    {
      key: 'techDepth', label: '技术实现深度', weight: 1.2,
      lowSignal: '纯 API 拼接，无工程化处理',
      highSignal: '深度工程化，自建推理逻辑/多Agent协作/模型微调',
      levels: {
        1: '纯 Prompt 拼接或直接调用通用大模型 API，无任何工程化处理，输入输出未经加工',
        2: '调用单个 API + 简单 Prompt 模板，有基本输入输出处理，但无检索增强、无流程编排、无定制逻辑',
        3: '有明确技术栈选型（RAG 检索增强 / Agent 工作流 / 向量数据库等），实现了基本工程化处理，但深度有限',
        4: '有较深技术实现：多轮 Agent 编排 / 自建 RAG Pipeline / 模型微调 / 自定义工具链，有代码结构和设计思路',
        5: '深度工程化：自建推理逻辑 / 多 Agent 协作 / 模型微调+评估闭环 / 自建向量检索+重排序，有完整技术架构文档',
      },
    },
    {
      key: 'engineeringQuality', label: '工程质量与可落地性', weight: 1.0,
      lowSignal: '纯 PPT 概念，无法运行验证',
      highSignal: '生产级质量，真实数据验证，可直接推广部署',
      levels: {
        1: '纯 PPT 概念演示，无任何可运行代码或实际数据，无法验证效果',
        2: '有 Demo 截图或录屏，但无法独立运行，或仅在特定环境/硬编码数据下可用',
        3: '有可运行 Demo，能跑通基本流程，使用了真实业务数据，但缺少异常处理和边界验证',
        4: '有稳定可运行的系统，使用真实业务数据验证，有明确效果指标（准确率/响应时间/覆盖率等），具备基本容错和日志',
        5: '生产级质量：稳定运行、真实数据验证、有量化效果对比（AI 前 vs AI 后）、有监控告警、可直接推广部署',
      },
    },
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
