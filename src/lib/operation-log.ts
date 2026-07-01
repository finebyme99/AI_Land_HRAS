import { getSupabaseAdmin } from './supabase-admin';
import {
  buildOperationLogRow,
  type OperationLogInput,
  type OperationLogOperator,
  type OperationLogRow,
} from './operation-log-row';

export { buildOperationLogRow };
export type {
  OperationLogAction,
  OperationLogInput,
  OperationLogInsertRow,
  OperationLogOperator,
  OperationLogRow,
  OperationLogSource,
  OperationLogStatus,
} from './operation-log-row';

export async function getOperationLogOperator(userId: string): Promise<OperationLogOperator> {
  const { data } = await getSupabaseAdmin()
    .from('users')
    .select('id, name')
    .eq('id', userId)
    .maybeSingle();

  return {
    id: userId,
    name: typeof data?.name === 'string' && data.name.trim() ? data.name : userId,
  };
}

export async function recordOperationLog(input: OperationLogInput): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('operation_logs')
    .insert(buildOperationLogRow(input));

  if (error) throw error;
}

export async function recordCompetitionSyncOperationLog(input: Omit<OperationLogInput, 'action'>): Promise<void> {
  await recordOperationLog({
    action: 'competition_sync',
    ...input,
  });
}

export async function listOperationLogs(limit = 100): Promise<OperationLogRow[]> {
  const normalizedLimit = Math.max(1, Math.min(limit, 200));
  const { data, error } = await getSupabaseAdmin()
    .from('operation_logs')
    .select('id, action, source, operator_user_id, operator_name, request_time, status, result, created_at')
    .order('request_time', { ascending: false })
    .limit(normalizedLimit);

  if (error) throw error;
  return (data ?? []) as OperationLogRow[];
}
