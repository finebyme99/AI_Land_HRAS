import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  ALL_COMPETITION_PERIODS,
  buildCompetitionTimelinePeriods,
  filterByCompetitionPeriod,
  isAllCompetitionPeriod,
} from '../src/lib/competition-periods.ts';

test('competition timeline periods always start with the all-period option', () => {
  assert.deepEqual(
    buildCompetitionTimelinePeriods(['2604', '2605']).slice(0, 4),
    [ALL_COMPETITION_PERIODS, '2604', '2605', '2606'],
  );
});

test('all-period selection keeps entries from every review period', () => {
  const items = [
    { title: 'A', reviewPeriod: '2604' },
    { title: 'B', reviewPeriod: '2605' },
  ];

  assert.equal(isAllCompetitionPeriod(ALL_COMPETITION_PERIODS), true);
  assert.deepEqual(
    filterByCompetitionPeriod(items, ALL_COMPETITION_PERIODS, (item) => item.reviewPeriod).map((item) => item.title),
    ['A', 'B'],
  );
  assert.deepEqual(
    filterByCompetitionPeriod(items, '2605', (item) => item.reviewPeriod).map((item) => item.title),
    ['B'],
  );
});
