// src/lib/course-card-handler.ts
// 处理用户从飞书卡片提交课程信息
// 路由：event_type = card.action.trigger, action.tag = form_submit, action.name = 'course_form'

import { insertCourseRow } from '@/lib/courses-insert';
import { buildSuccessCard, buildErrorCard, replaceFeishuCard } from '@/lib/feishu-message';

export interface CourseFormValue {
  title?: string;
  instructor?: string;
  content_type?: string | string[];
  published_at?: string;
  cover_image?: string;
  courseware_url?: string;
  video_url?: string;
  period?: string;
}

function normalizeContentType(v: string | string[] | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  return [v];
}

function toDateString(v: string | undefined): string | undefined {
  // 飞书 date_picker 返回 'YYYY-MM-DD'；原样透传
  if (!v) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(v + 'T00:00:00.000Z').toISOString();
  }
  return v; // 已是 ISO
}

export async function handleCourseCardSubmit(
  formValue: CourseFormValue,
  messageId: string,
): Promise<{ ok: boolean; error?: string }> {
  // 1. 校验必填
  const missing: string[] = [];
  if (!formValue.title?.trim()) missing.push('title');
  if (!formValue.instructor?.trim()) missing.push('instructor');
  const contentTypes = normalizeContentType(formValue.content_type);
  if (contentTypes.length === 0) missing.push('content_type');

  if (missing.length > 0) {
    await replaceFeishuCard(
      messageId,
      buildErrorCard(`必填字段缺失：${missing.join(', ')}`, formValue as Record<string, unknown>),
    );
    return { ok: false, error: `missing: ${missing.join(', ')}` };
  }

  // 2. 写库
  const { course, error } = await insertCourseRow({
    title: formValue.title!.trim(),
    instructor: formValue.instructor!.trim(),
    description: '',
    duration: '',
    difficulty: '初阶',
    content_type: contentTypes,
    cover_image: formValue.cover_image?.trim() || undefined,
    courseware_url: formValue.courseware_url?.trim() || undefined,
    video_url: formValue.video_url?.trim() || undefined,
    period: formValue.period?.trim() || null,
    created_at: toDateString(formValue.published_at),
  });

  // 3. 替换原卡片
  if (error || !course) {
    await replaceFeishuCard(
      messageId,
      buildErrorCard(error || '写入失败', formValue as Record<string, unknown>),
    );
    return { ok: false, error };
  }

  await replaceFeishuCard(
    messageId,
    buildSuccessCard({ id: course.id, title: course.title, instructor: formValue.instructor }),
  );
  return { ok: true };
}
