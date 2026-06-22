import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { buildAiLandFieldAssets } from '../src/lib/bitable/field-assets.ts';

const pageLabels = {
  choDashboard: '成效看板',
  wishPool: '场景池',
  wishPoolCard: '场景池卡片',
};

const pageUsage = {
  choDashboard: new Set(['title', 'valueStarLevel']),
  wishPool: new Set(['title', 'recordUrl']),
  wishPoolCard: new Set(['title']),
};

test('groups Feishu source rows by AI Land field and keeps structured aliases', () => {
  const result = buildAiLandFieldAssets({
    rows: [{
      id: 'row-title',
      field_id: 'fld_title',
      field_name: '场景名称',
      previous_field_name: '场景标题',
      key: 'title',
      type: 'text',
      group_name: '场景信息',
      is_active: true,
      roles: ['sync', 'progress', 'wish-pool'],
      sort_order: 1,
      status: 'renamed',
    }],
    fieldLabels: { title: '名称' },
    pageLabels,
    pageUsage,
    calculatedFields: [],
    systemFields: [],
  });

  assert.equal(result.assets.length, 1);
  assert.equal(result.assets[0].key, 'title');
  assert.equal(result.assets[0].displayName, '名称 / 场景名称');
  assert.deepEqual(result.assets[0].usage.map((u) => u.label), ['成效看板', '场景池', '场景池卡片']);
  assert.equal(result.assets[0].sourceType, 'feishu_bitable');
  assert.equal(result.assets[0].sourceDetail.currentFieldName, '场景名称');
  assert.deepEqual(result.assets[0].renameInfo, {
    renamed: true,
    currentName: '场景名称',
    previousNames: ['场景标题'],
  });
  assert.deepEqual(result.assets[0].aliases, [
    { label: '名称', context: 'AI Land标准字段' },
    { label: '场景名称', context: '飞书多维表字段' },
    { label: '场景标题', context: '飞书历史字段名' },
  ]);
});

test('separates unknown Feishu fields into the unused inbox', () => {
  const result = buildAiLandFieldAssets({
    rows: [{
      id: 'row-new',
      field_id: 'fld_new',
      field_name: '新业务字段',
      key: 'unknown_fld_new',
      type: 'text',
      group_name: '未分组',
      is_active: false,
      roles: ['sync', 'progress', 'wish-pool'],
      sort_order: 9,
      status: 'new',
    }],
    fieldLabels: {},
    pageLabels,
    pageUsage,
    calculatedFields: [],
    systemFields: [],
  });

  assert.equal(result.assets.length, 0);
  assert.equal(result.unusedFeishuFields.length, 1);
  assert.equal(result.unusedFeishuFields[0].fieldName, '新业务字段');
  assert.equal(result.unusedFeishuFields[0].status, 'new');
  assert.equal(result.stats.unusedFeishu, 1);
});

test('includes AI Land calculated and system fields with dependencies', () => {
  const result = buildAiLandFieldAssets({
    rows: [],
    fieldLabels: { finalValueScore: '最终价值计分' },
    pageLabels,
    pageUsage,
    calculatedFields: [{
      key: 'valueStarLevel',
      label: '价值星级',
      logic: '按最终价值计分排名分配 1-5 星',
      dependencyKeys: ['finalValueScore'],
      implementation: 'assignValueStarLevels',
    }],
    systemFields: [{
      key: 'recordUrl',
      label: '飞书记录链接',
      logic: '根据飞书记录 ID 生成跳转链接',
      implementation: 'mapFeishuRecord',
    }],
  });

  assert.deepEqual(result.assets.map((a) => a.key), ['valueStarLevel', 'recordUrl']);
  assert.equal(result.assets[0].sourceType, 'ai_land_calculated');
  assert.deepEqual(result.assets[0].dependencies, [{ key: 'finalValueScore', label: '最终价值计分' }]);
  assert.equal(result.assets[1].sourceType, 'ai_land_system');
  assert.equal(result.assets[1].usage[0].label, '场景池');
});

test('counts page usage through structured AI Land key aliases', () => {
  const result = buildAiLandFieldAssets({
    rows: [{
      id: 'row-total',
      field_id: 'fld_total_saved_hours',
      field_name: '月均节省总工时',
      key: 'totalSavedHours',
      type: 'formula',
      group_name: '价值计分',
      is_active: true,
      roles: ['sync', 'progress', 'wish-pool'],
      sort_order: 4,
      status: 'synced',
    }],
    fieldLabels: {
      totalSavedHours: '月均节省总工时',
      totalMonthlySavedHours: '月均节省总工时',
    },
    pageLabels,
    pageUsage: {
      choDashboard: new Set(['totalMonthlySavedHours']),
      wishPool: new Set(['totalSavedHours']),
      wishPoolCard: new Set([]),
    },
    keyAliases: {
      totalSavedHours: ['totalMonthlySavedHours'],
    },
    calculatedFields: [],
    systemFields: [],
  });

  assert.deepEqual(result.assets[0].usage.map((u) => u.label), ['成效看板', '场景池']);
  assert.ok(result.assets[0].aliases.some((alias) => (
    alias.context === '成效看板字段' && alias.label === '月均节省总工时'
  )));
  assert.equal(result.assets[0].displayName, '月均节省总工时');
});
