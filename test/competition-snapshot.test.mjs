import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  buildCompetitionSnapshotUpsertRow,
  getCanonicalCompetitionSnapshotId,
  mapCompetitionSnapshotRowToWishItem,
} from '../src/lib/competition-snapshot.ts';

test('maps Supabase competition_submissions rows to shared WishItem shape', () => {
  const item = mapCompetitionSnapshotRowToWishItem({
    id: 'rec-1',
    record_url: 'https://example.test/record',
    title: '智能招聘排班',
    submitter: ['张三'],
    team_members: ['李四'],
    team: ['SSC'],
    scene_category: '招聘',
    ai_tools: ['Coze'],
    status: '评审中',
    period: '2606',
    landing_progress: '试点上线',
    scene_source: 'AI大赛',
    monthly_saved_hours: 12,
    monthly_saved_cost: '3000',
    monthly_cost_saving_hours: 8,
    total_monthly_saved_hours: 20,
    efficiency_rate: 0.4,
    final_value_score: 80,
    brief_intro: '自动生成候选人排班建议',
    before_process: '人工确认时间',
    after_process: 'AI 推荐时间',
    old_operation_count: 3,
    new_operation_count: 1,
    old_frequency: '每周',
    new_frequency: '每周',
    old_hours_per_task: 2,
    new_duration: 0.5,
    before_people_count: 2,
    after_people_count: 1,
    before_freq: 12,
    after_freq: 4,
    before_monthly_hours: 48,
    after_monthly_hours: 2,
    ai_cost: '100',
    reuse_value: '跨BU x3',
    reuse_value_level: '跨BU',
    reuse_value_coefficient: 3,
    region_coefficient: '国内',
    scene_region_coefficient_value: 1,
    extra_value: '提效',
    pain_points: ['沟通成本高'],
    cost_reduction_note: '减少外包',
    implementation: '流程编排',
    implementation_link: 'https://example.test/demo',
  });

  assert.equal(item.id, 'rec-1');
  assert.equal(item.title, '智能招聘排班');
  assert.deepEqual(item.submitter, ['张三']);
  assert.deepEqual(item.teamMembers, ['李四']);
  assert.equal(item.team, 'SSC');
  assert.equal(item.competitionProgress, '评审中');
  assert.equal(item.reviewPeriod, '2606');
  assert.equal(item.landingProgress, '试点上线');
  assert.equal(item.sceneSource, 'AI大赛');
  assert.equal(item.monthlySavedHours, 12);
  assert.equal(item.monthlySavedCost, 3000);
  assert.equal(item.costSavedHours, 8);
  assert.equal(item.totalSavedHours, 20);
  assert.equal(item.totalEfficiencyRate, 0.4);
  assert.equal(item.beforeHoursPerTask, 2);
  assert.equal(item.afterHoursPerTask, 0.5);
  assert.equal(item.reuseValueNumber, 3);
  assert.equal(item.regionCoefficientValue, 1);
});

test('page data GET routes read Supabase snapshots instead of Feishu records', () => {
  const routeFiles = [
    'src/app/api/wish-pool/route.ts',
    'src/app/api/competitions/progress/route.ts',
  ];

  for (const file of routeFiles) {
    const source = readFileSync(file, 'utf8');
    assert.equal(source.includes('getTenantAccessToken'), false, `${file} should not request Feishu tokens`);
    assert.equal(source.includes('open.feishu.cn'), false, `${file} should not call Feishu APIs`);
    assert.equal(source.includes('/bitable/v1/apps/'), false, `${file} should not call Feishu records`);
    assert.equal(source.includes("from('competition_submissions')"), true, `${file} should read the snapshot table`);
  }
});

test('builds Supabase snapshot upsert rows from mapped Feishu items', () => {
  const row = buildCompetitionSnapshotUpsertRow({
    id: 'rec-2',
    recordUrl: 'https://example.test/rec-2',
    title: '智能入职助手',
    submitter: ['王五'],
    teamMembers: ['赵六'],
    team: 'COE',
    sceneCategory: '员工服务',
    aiTools: ['Dify'],
    competitionProgress: '终审通过',
    reviewPeriod: '2606',
    landingProgress: '全面上线',
    sceneSource: 'AI大赛',
    monthlySavedHours: 10,
    monthlySavedCost: 2000,
    costSavedHours: 6,
    totalSavedHours: 16,
    totalEfficiencyRate: 0.5,
    finalValueScore: 64,
    reuseValueNumber: 4,
    regionCoefficientValue: 1.5,
  });

  assert.equal(row.id, 'rec-2');
  assert.equal(row.record_url, 'https://example.test/rec-2');
  assert.equal(row.period, '2606');
  assert.equal(row.status, '终审通过');
  assert.deepEqual(row.team, ['COE']);
  assert.equal(row.scene_category, '员工服务');
  assert.equal(row.total_monthly_saved_hours, 16);
  assert.equal(row.reuse_value_coefficient, 4);
  assert.equal(row.scene_region_coefficient_value, 1.5);
});

test('canonical snapshot id prefers linked legacy competition record ids', () => {
  assert.equal(
    getCanonicalCompetitionSnapshotId({
      record_id: 'new-record-id',
      fields: {
        '关联参赛项目': [{ record_ids: ['legacy-record-id'] }],
      },
    }),
    'legacy-record-id',
  );

  assert.equal(
    getCanonicalCompetitionSnapshotId({
      record_id: 'new-record-id',
      fields: {},
    }),
    'new-record-id',
  );
});
