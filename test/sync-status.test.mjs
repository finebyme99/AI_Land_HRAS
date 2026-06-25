import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { buildCompetitionSyncSummary, formatSnapshotStatus, getLatestSyncedAt } from '../src/lib/sync-status.ts';

test('gets the newest synced_at timestamp from snapshot rows', () => {
  assert.equal(
    getLatestSyncedAt([
      { synced_at: '2026-06-24T09:00:00.000Z' },
      { synced_at: null },
      { synced_at: '2026-06-25T01:20:00.000Z' },
      { synced_at: 'bad-date' },
    ]),
    '2026-06-25T01:20:00.000Z',
  );
});

test('formats local snapshot status without implying Feishu is live', () => {
  assert.equal(
    formatSnapshotStatus('2026-06-25T01:20:00.000Z'),
    '数据最近更新时间：2026/06/25 09:20',
  );

  assert.equal(
    formatSnapshotStatus(null),
    'AI Land 快照尚未记录同步时间',
  );
});

test('builds a compact competition sync summary for admin display', () => {
  assert.deepEqual(
    buildCompetitionSyncSummary({
      fetched: 10,
      upserted: 8,
      changed: 3,
      skipped: 2,
      removedDuplicates: 1,
    }),
    {
      fetched: 10,
      succeeded: 8,
      changed: 3,
      skipped: 2,
      removedDuplicates: 1,
    },
  );
});
