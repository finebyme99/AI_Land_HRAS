export interface SyncedAtRow {
  synced_at?: string | null;
}

export interface CompetitionSyncRawResult {
  fetched: number;
  upserted: number;
  changed: number;
  skipped: number;
  removedDuplicates: number;
}

export interface CompetitionSyncSummary {
  fetched: number;
  succeeded: number;
  changed: number;
  skipped: number;
  removedDuplicates: number;
}

function parseSyncedAt(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

export function getLatestSyncedAt(rows: SyncedAtRow[]): string | null {
  let latestValue: string | null = null;
  let latestTime = -Infinity;

  for (const row of rows) {
    const time = parseSyncedAt(row.synced_at);
    if (time == null || time <= latestTime) continue;
    latestTime = time;
    latestValue = row.synced_at ?? null;
  }

  return latestValue;
}

export function formatSnapshotStatus(lastSyncedAt: string | null | undefined): string {
  const time = parseSyncedAt(lastSyncedAt);
  if (time == null) return 'AI Land 快照尚未记录同步时间';

  const formatted = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(time));

  return `数据最近更新时间：${formatted}`;
}

export function buildCompetitionSyncSummary(result: CompetitionSyncRawResult): CompetitionSyncSummary {
  return {
    fetched: result.fetched,
    succeeded: result.upserted,
    changed: result.changed,
    skipped: result.skipped,
    removedDuplicates: result.removedDuplicates,
  };
}
