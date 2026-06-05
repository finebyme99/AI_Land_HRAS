// src/lib/courses-insert.ts
// 共享 insert 逻辑 — 供 web 端 POST /api/courses 和飞书卡片回调 handler 共用
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export interface CourseInsertInput {
  title: string;
  description?: string;
  instructor: string;
  duration?: string;
  difficulty?: string;
  content_type?: string[];
  cover_image?: string;
  courseware_url?: string;
  video_url?: string;
  created_at?: string;
  period?: string | null;
}

export interface InsertCourseResult {
  course: { id: string; title: string; created_at: string } | null;
  error: string | null;
}

/**
 * 写入一行 courses。
 * 必填：title、instructor。其他字段允许空字符串 / 默认值，避免前端漏填被后端拒。
 */
export async function insertCourseRow(input: CourseInsertInput): Promise<InsertCourseResult> {
  const { title, description, instructor, duration, difficulty, content_type, cover_image, courseware_url, video_url, created_at, period } = input;

  if (!title || !instructor) {
    return { course: null, error: 'title 和 instructor 必填' };
  }

  const insertData: Record<string, unknown> = {
    title,
    description: description ?? '',
    instructor,
    duration: duration ?? '',
    difficulty: difficulty ?? '初阶',
    content_type: content_type ?? [],
    cover_image: cover_image ?? '',
    courseware_url: courseware_url ?? '',
    video_url: video_url ?? '',
  };
  if (created_at) insertData.created_at = created_at;
  if (period) insertData.period = period;

  const { data, error } = await getSupabaseAdmin()
    .from('courses')
    .insert(insertData)
    .select('id, title, created_at')
    .single();

  if (error) {
    return { course: null, error: error.message };
  }
  return { course: data, error: null };
}
