function courseSyncErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const code = typeof record.code === 'string' && record.code ? `${record.code}: ` : '';
    const message = typeof record.message === 'string' && record.message ? record.message : null;
    if (message) return `${code}${message}`;
  }

  return String(error);
}

export function assertCourseWriteSucceeded(error: unknown): void {
  if (!error) return;
  throw new Error(`写入课程失败: ${courseSyncErrorMessage(error)}`);
}

export interface BuildCourseSyncRowInput {
  feishuRecordId: string;
  title: string;
  instructor: string;
  createdAt: string | null;
  videoUrl: string;
  coursewareUrl: string;
  contentType: string[];
  period: string | null;
  season: string | null;
  coverImageKey: string | null;
}

export function buildCourseSyncRow(input: BuildCourseSyncRowInput): Record<string, unknown> {
  return {
    feishu_record_id: input.feishuRecordId,
    title: input.title,
    description: '',
    instructor: input.instructor || '待定',
    duration: '',
    difficulty: '初阶',
    created_at: input.createdAt,
    video_url: input.videoUrl,
    courseware_url: input.coursewareUrl,
    content_type: input.contentType.length > 0 ? input.contentType : ['doc'],
    period: input.period,
    season: input.season,
    cover_image_key: input.coverImageKey,
    synced_at: new Date().toISOString(),
  };
}
