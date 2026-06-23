import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  buildPublishedCasePointEvents,
  buildPublishedResourcePointEvents,
  buildCompetitionPointEvents,
  getLevelProgress,
  getUserLevelByPoints,
} from '../src/lib/user-growth.ts';

test('user level thresholds include the two highest levels', () => {
  assert.equal(getUserLevelByPoints(-10), '灵识初启');
  assert.equal(getUserLevelByPoints(0), '灵识初启');
  assert.equal(getUserLevelByPoints(49), '灵识初启');
  assert.equal(getUserLevelByPoints(50), '问道学徒');
  assert.equal(getUserLevelByPoints(149), '问道学徒');
  assert.equal(getUserLevelByPoints(150), '算法筑基');
  assert.equal(getUserLevelByPoints(299), '算法筑基');
  assert.equal(getUserLevelByPoints(300), '智核结丹');
  assert.equal(getUserLevelByPoints(599), '智核结丹');
  assert.equal(getUserLevelByPoints(600), '万象化神');
  assert.equal(getUserLevelByPoints(999), '万象化神');
  assert.equal(getUserLevelByPoints(1000), '天机掌门');
});

test('competition submitters get 50 points and members get 25 points per submission', () => {
  const events = buildCompetitionPointEvents([
    {
      id: 'rec1',
      submitter: ['张三'],
      team_members: [' 张三 ', '李四', '李四'],
    },
    {
      id: 'rec2',
      submitter: '王五',
      teamMembers: ['李四', '赵六'],
    },
  ]);

  assert.deepEqual(events, [
    { sourceId: 'rec1', participantName: '张三', reason: 'competition_submitter', points: 50 },
    { sourceId: 'rec1', participantName: '李四', reason: 'competition_member', points: 25 },
    { sourceId: 'rec2', participantName: '王五', reason: 'competition_submitter', points: 50 },
    { sourceId: 'rec2', participantName: '李四', reason: 'competition_member', points: 25 },
    { sourceId: 'rec2', participantName: '赵六', reason: 'competition_member', points: 25 },
  ]);
});

test('published cases create historical contribution point events', () => {
  const events = buildPublishedCasePointEvents([
    { id: 'case-1', author_id: 'user-1', status: 'published' },
    { id: 'case-2', author_id: 'user-1', status: 'draft' },
    { id: 'case-3', author_id: null, status: 'published' },
  ]);

  assert.deepEqual(events, [
    { sourceId: 'case-1', userId: 'user-1', reason: 'case_published', points: 10 },
  ]);
});

test('published resources create historical contribution point events', () => {
  const events = buildPublishedResourcePointEvents([
    { id: 'app-1', author_id: 'user-1', status: 'published' },
    { id: 'app-2', author_id: 'user-1', status: 'pending' },
    { id: 'app-3', author_id: null, status: 'published' },
  ]);

  assert.deepEqual(events, [
    { sourceId: 'app-1', userId: 'user-1', reason: 'resource_published', points: 10 },
  ]);
});

test('level progress explains the current and next level', () => {
  assert.deepEqual(getLevelProgress(625), {
    level: '万象化神',
    currentMin: 600,
    nextLevel: '天机掌门',
    nextMin: 1000,
    pointsToNext: 375,
    progress: 6,
  });

  assert.deepEqual(getLevelProgress(1200), {
    level: '天机掌门',
    currentMin: 1000,
    nextLevel: null,
    nextMin: null,
    pointsToNext: 0,
    progress: 100,
  });
});
