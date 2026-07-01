import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

test('operation log rows capture sync source, operator, request time, and result', async () => {
  const { buildOperationLogRow } = await import('../src/lib/operation-log-row.ts');

  assert.deepEqual(buildOperationLogRow({
    action: 'competition_sync',
    source: 'admin',
    operator: { id: 'd5185981-fa9b-44ff-a945-79e1ac9e0e9f', name: '郭谦' },
    requestTime: '2026-06-30T12:28:17.138Z',
    status: 'success',
    result: { fetched: 40, succeeded: 40, changed: 40 },
  }), {
    action: 'competition_sync',
    source: 'admin',
    operator_user_id: 'd5185981-fa9b-44ff-a945-79e1ac9e0e9f',
    operator_name: '郭谦',
    request_time: '2026-06-30T12:28:17.138Z',
    status: 'success',
    result: { fetched: 40, succeeded: 40, changed: 40 },
  });
});

test('operation log migration creates the audit table', () => {
  const migration = 'supabase/migrations/075_operation_logs.sql';
  assert.equal(existsSync(migration), true);

  const source = readFileSync(migration, 'utf8');
  assert.match(source, /CREATE TABLE IF NOT EXISTS operation_logs/);
  assert.match(source, /source text NOT NULL/);
  assert.match(source, /operator_user_id uuid REFERENCES users\(id\)/);
  assert.match(source, /operator_name text/);
  assert.match(source, /request_time timestamptz NOT NULL/);
  assert.match(source, /result jsonb NOT NULL/);
});

test('competition sync entrypoints record admin and cron operation logs', () => {
  const adminRoute = readFileSync('src/app/api/admin/competition-sync/route.ts', 'utf8');
  const cronRoute = readFileSync('src/app/api/cron/sync-competitions/route.ts', 'utf8');

  assert.equal(adminRoute.includes('recordCompetitionSyncOperationLog'), true);
  assert.equal(adminRoute.includes("source: 'admin'"), true);
  assert.equal(adminRoute.includes('getOperationLogOperator'), true);
  assert.equal(cronRoute.includes('recordCompetitionSyncOperationLog'), true);
  assert.equal(cronRoute.includes("source: 'cron'"), true);
});

test('operation logs are the last management menu item', () => {
  const navigation = readFileSync('src/components/Navigation.tsx', 'utf8');
  const reviewIdx = navigation.indexOf("label: '内容审核'");
  const feishuIdx = navigation.indexOf("label: '飞书应用配置'");
  const operationLogIdx = navigation.indexOf("label: '操作日志'");

  assert.ok(reviewIdx > -1);
  assert.ok(feishuIdx > reviewIdx);
  assert.ok(operationLogIdx > feishuIdx);
  assert.equal(navigation.includes("key: '/admin/operation-logs'"), true);
});
