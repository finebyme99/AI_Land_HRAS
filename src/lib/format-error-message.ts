function stringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const code = stringField(record, 'code');
    const message = stringField(record, 'message');
    const details = stringField(record, 'details');
    const hint = stringField(record, 'hint');

    if (message) {
      const prefix = code ? `${code}: ` : '';
      const suffix = [details ? `details: ${details}` : null, hint ? `hint: ${hint}` : null]
        .filter((part): part is string => part !== null)
        .join('; ');

      return suffix ? `${prefix}${message} (${suffix})` : `${prefix}${message}`;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }

  return String(error);
}
