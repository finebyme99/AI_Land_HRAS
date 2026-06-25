import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

test('foreground competition pages do not expose Feishu sync buttons', () => {
  const files = [
    'src/app/wish-pool/page.tsx',
    'src/app/competitions/page.tsx',
    'src/components/ChoDashboard.tsx',
  ];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.equal(source.includes('同步快照'), false, `${file} should not show snapshot sync`);
    assert.equal(source.includes('同步数据'), false, `${file} should not show competition sync`);
    assert.equal(source.includes('从飞书同步'), false, `${file} should not show Feishu sync`);
    assert.equal(source.includes('/api/competitions/sync'), false, `${file} should not call the old sync API`);
    assert.equal(source.includes('/api/wish-pool/sync'), false, `${file} should not call the old wish-pool sync API`);
  }
});

test('admin field-map page owns the scene data sync entry', () => {
  const source = readFileSync('src/app/admin/bitable-field-map/page.tsx', 'utf8');

  assert.equal(source.includes('/api/admin/competition-sync'), true);
  assert.equal(source.includes('全量同步飞书场景数据'), true);
  assert.equal(source.includes('成功'), true);
  assert.equal(source.includes('变化'), true);
});

test('unused foreground sync API routes are removed or read-only', () => {
  assert.equal(existsSync('src/app/api/wish-pool/sync/route.ts'), false);
  assert.equal(existsSync('src/app/api/wish-pool/sync-field-map/route.ts'), false);

  const competitionSyncRoute = readFileSync('src/app/api/competitions/sync/route.ts', 'utf8');
  assert.equal(competitionSyncRoute.includes('export async function POST'), false);
  assert.equal(competitionSyncRoute.includes('getTenantAccessToken'), false);
});
