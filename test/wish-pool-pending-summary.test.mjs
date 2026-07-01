import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('pending wish-pool detail view shows estimated value in the shared summary headline', () => {
  const pageSource = readFileSync('src/app/wish-pool/page.tsx', 'utf8');
  const pendingBlockStart = pageSource.indexOf('label="待实现场景"');
  assert.ok(pendingBlockStart > -1);

  const pendingBlock = pageSource.slice(pendingBlockStart, pageSource.indexOf('<FormulaSection />', pendingBlockStart));
  assert.equal(pendingBlock.includes('showMetrics={false}'), false);
  assert.equal(pendingBlock.includes('showEstimatedValueLabel'), true);

  const detailBlockSource = readFileSync('src/components/DetailListBlock.tsx', 'utf8');
  assert.equal(detailBlockSource.includes('showEstimatedValueLabel'), true);
  assert.equal(detailBlockSource.includes('预估价值：'), true);
});
