export type OperationLogSource = 'admin' | 'cron';
export type OperationLogStatus = 'success' | 'failed';
export type OperationLogAction = 'competition_sync';

export interface OperationLogOperator {
  id: string | null;
  name: string | null;
}

export interface OperationLogInput {
  action: OperationLogAction;
  source: OperationLogSource;
  operator?: OperationLogOperator | null;
  requestTime: string;
  status: OperationLogStatus;
  result: Record<string, unknown>;
}

export interface OperationLogRow {
  id: string;
  action: OperationLogAction;
  source: OperationLogSource;
  operator_user_id: string | null;
  operator_name: string | null;
  request_time: string;
  status: OperationLogStatus;
  result: Record<string, unknown>;
  created_at: string;
}

export type OperationLogInsertRow = Omit<OperationLogRow, 'id' | 'created_at'>;

export function buildOperationLogRow(input: OperationLogInput): OperationLogInsertRow {
  return {
    action: input.action,
    source: input.source,
    operator_user_id: input.operator?.id ?? null,
    operator_name: input.operator?.name ?? (input.source === 'cron' ? 'Vercel Cron' : null),
    request_time: input.requestTime,
    status: input.status,
    result: input.result,
  };
}

export function normalizeOperationLogResult(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}
