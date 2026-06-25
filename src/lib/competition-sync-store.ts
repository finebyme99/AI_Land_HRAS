import { syncCompetitionSnapshot, type SyncCompetitionSnapshotResult } from './competition-snapshot-sync';
import { getSupabaseAdmin } from './supabase-admin';
import { buildCompetitionSyncSummary, type CompetitionSyncSummary } from './sync-status';

export type CompetitionSyncStatus = 'never' | 'success' | 'failed';

export interface StoredCompetitionSyncStatus {
  status: CompetitionSyncStatus;
  lastSyncedAt: string | null;
  lastAttemptedAt: string | null;
  result: (CompetitionSyncSummary & { error?: string }) | null;
}

function normalizeStatus(value: unknown): CompetitionSyncStatus {
  if (value === 'success' || value === 'failed') return value;
  return 'never';
}

function normalizeResult(value: unknown): StoredCompetitionSyncStatus['result'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return {
    fetched: Number(record.fetched ?? 0),
    succeeded: Number(record.succeeded ?? 0),
    changed: Number(record.changed ?? 0),
    skipped: Number(record.skipped ?? 0),
    removedDuplicates: Number(record.removedDuplicates ?? 0),
    error: typeof record.error === 'string' ? record.error : undefined,
  };
}

export async function getCompetitionSyncStatus(): Promise<StoredCompetitionSyncStatus> {
  const { data, error } = await getSupabaseAdmin()
    .from('platform_settings')
    .select('competition_last_synced_at, competition_last_sync_attempted_at, competition_last_sync_status, competition_last_sync_result')
    .eq('id', 1)
    .single();

  if (error || !data) {
    return { status: 'never', lastSyncedAt: null, lastAttemptedAt: null, result: null };
  }

  return {
    status: normalizeStatus(data.competition_last_sync_status),
    lastSyncedAt: data.competition_last_synced_at ?? null,
    lastAttemptedAt: data.competition_last_sync_attempted_at ?? null,
    result: normalizeResult(data.competition_last_sync_result),
  };
}

export async function recordCompetitionSyncSuccess(result: SyncCompetitionSnapshotResult): Promise<StoredCompetitionSyncStatus> {
  const syncedAt = new Date().toISOString();
  const summary = buildCompetitionSyncSummary(result);

  const { error } = await getSupabaseAdmin()
    .from('platform_settings')
    .upsert({
      id: 1,
      competition_last_synced_at: syncedAt,
      competition_last_sync_attempted_at: syncedAt,
      competition_last_sync_status: 'success',
      competition_last_sync_result: summary,
      updated_at: syncedAt,
    }, { onConflict: 'id' });

  if (error) throw error;

  return {
    status: 'success',
    lastSyncedAt: syncedAt,
    lastAttemptedAt: syncedAt,
    result: summary,
  };
}

export async function recordCompetitionSyncFailure(errorMessage: string): Promise<StoredCompetitionSyncStatus> {
  const attemptedAt = new Date().toISOString();
  const result = {
    fetched: 0,
    succeeded: 0,
    changed: 0,
    skipped: 0,
    removedDuplicates: 0,
    error: errorMessage,
  };

  const { error } = await getSupabaseAdmin()
    .from('platform_settings')
    .upsert({
      id: 1,
      competition_last_sync_attempted_at: attemptedAt,
      competition_last_sync_status: 'failed',
      competition_last_sync_result: result,
      updated_at: attemptedAt,
    }, { onConflict: 'id' });

  if (error) throw error;

  const current = await getCompetitionSyncStatus();
  return {
    ...current,
    status: 'failed',
    lastAttemptedAt: attemptedAt,
    result,
  };
}

export async function runCompetitionSyncAndRecordStatus(): Promise<{
  sync: SyncCompetitionSnapshotResult;
  status: StoredCompetitionSyncStatus;
}> {
  const sync = await syncCompetitionSnapshot({ scope: 'all' });
  const status = await recordCompetitionSyncSuccess(sync);
  return { sync, status };
}
