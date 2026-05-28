// ============ 用户 ============
export interface User {
  id: string;
  feishu_open_id: string;
  name: string;
  avatar: string;
  department: string;
  role: 'user' | 'contributor' | 'moderator' | 'admin';
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
  created_at: string;
  updated_at: string;
}

// ============ 应用推荐 ============
export type AppCategory = '对话类' | '写作类' | '设计类' | '数据分析' | '自动化' | 'HR专属';

export interface AppRecommendation {
  id: string;
  name: string;
  logo: string;
  description: string;
  category: AppCategory;
  scenarios: string[];
  official_url: string;
  rating: number;
  user_count: number;
  like_count: number;
  dislike_count: number;
  is_featured?: boolean;
  created_at: string;
}

// ============ 课程 ============
export type CourseCategory = 'AI工具基础' | 'HR场景实操' | 'AI工具进阶';
export type CourseDifficulty = '入门' | '基础' | '进阶';
export type ContentType = 'video' | 'doc';

export interface Course {
  id: string;
  title: string;
  description: string;
  cover_image: string;
  instructor: string;
  category: CourseCategory;
  difficulty: CourseDifficulty;
  duration: string;
  content_type: ContentType;
  chapters: CourseChapter[];
  student_count: number;
  rating: number;
  is_featured?: boolean;
  created_at: string;
}

export interface CourseChapter {
  id: string;
  title: string;
  content_url: string;
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

// ============ 话题 ============

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
