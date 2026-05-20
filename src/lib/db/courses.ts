import { getSupabase } from '../supabase';
import type { Course, CourseCategory, CourseDifficulty, ContentType } from '@/types';

// 获取课程列表
export async function getCourses(options?: {
  category?: CourseCategory;
  difficulty?: CourseDifficulty;
  contentType?: ContentType;
  search?: string;
}) {
  let query = getSupabase()
    .from('courses')
    .select(`
      *,
      chapters:course_chapters(*)
    `)
    .order('created_at', { ascending: false });

  if (options?.category) query = query.eq('category', options.category);
  if (options?.difficulty) query = query.eq('difficulty', options.difficulty);
  if (options?.contentType) query = query.eq('content_type', options.contentType);
  if (options?.search) query = query.or(`title.ilike.%${options.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data as Course[];
}

// 获取单个课程
export async function getCourse(id: string) {
  const { data, error } = await getSupabase()
    .from('courses')
    .select(`
      *,
      chapters:course_chapters(*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Course;
}
