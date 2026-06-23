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
