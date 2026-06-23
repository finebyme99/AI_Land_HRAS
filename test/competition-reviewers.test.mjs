import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { attachReviewersToReviews } from '../src/lib/competition-reviewers.ts';

test('attaches reviewer profiles by reviewer_id without requiring database relationships', () => {
  const reviews = [
    { id: 'review-1', reviewer_id: 'user-1', decision: 'reviewed' },
    { id: 'review-2', reviewer_id: 'missing-user', decision: 'reviewed' },
  ];
  const users = [
    { id: 'user-1', name: 'Reviewer One', avatar: 'avatar.png', department: 'HR' },
  ];

  assert.deepEqual(attachReviewersToReviews(reviews, users), [
    {
      id: 'review-1',
      reviewer_id: 'user-1',
      decision: 'reviewed',
      reviewer: { id: 'user-1', name: 'Reviewer One', avatar: 'avatar.png', department: 'HR' },
    },
    {
      id: 'review-2',
      reviewer_id: 'missing-user',
      decision: 'reviewed',
      reviewer: null,
    },
  ]);
});
