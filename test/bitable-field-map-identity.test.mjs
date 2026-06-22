import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { buildFieldMapSyncPlan } from '../src/lib/bitable/field-map-identity.ts';

test('field map sync matches renamed Feishu fields by field_id before field_name', () => {
  const existingRows = [{
    id: 'row-1',
    field_id: 'fld_stable_title',
    field_name: '场景名称',
    key: 'title',
    type: 'text',
    group_name: '场景信息',
    is_active: true,
    roles: ['sync', 'progress', 'wish-pool'],
    sort_order: 1,
  }];
  const feishuFields = [{
    field_id: 'fld_stable_title',
    field_name: '场景标题',
    group_name: '场景信息',
    description: '改名后的字段说明',
    options: null,
  }];

  const plan = buildFieldMapSyncPlan(existingRows, feishuFields, {
    baseApp: 'base',
    tableId: 'table',
    fillKnownOnly: true,
  });

  assert.equal(plan.toInsert.length, 0);
  assert.deepEqual(plan.toUpdate, [{
    id: 'row-1',
    field_id: 'fld_stable_title',
    field_name: '场景标题',
    group_name: '场景信息',
    description: '改名后的字段说明',
    options: null,
  }]);
  assert.deepEqual(plan.fieldDescriptions, { title: '改名后的字段说明' });
});

test('field map sync preserves known mappings when renamed field name has no fallback entry', () => {
  const existingRows = [{
    id: 'row-2',
    field_id: 'fld_stable_score',
    field_name: '最终价值计分',
    key: 'finalValueScore',
    type: 'formula',
    group_name: '价值计分',
    is_active: true,
    roles: ['sync', 'progress', 'wish-pool'],
    sort_order: 2,
  }];
  const feishuFields = [{
    field_id: 'fld_stable_score',
    field_name: '最终价值得分',
    group_name: '价值计分',
    description: '',
    options: null,
  }];

  const plan = buildFieldMapSyncPlan(existingRows, feishuFields, {
    baseApp: 'base',
    tableId: 'table',
    fillKnownOnly: true,
  });

  assert.equal(plan.toInsert.length, 0);
  assert.equal(plan.skipped, 0);
  assert.equal(plan.toUpdate[0].field_name, '最终价值得分');
});
