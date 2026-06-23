import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { assertCourseWriteSucceeded } from '../src/lib/course-sync.ts';

test('throws a readable error when course writes fail', () => {
  assert.throws(
    () => assertCourseWriteSucceeded({
      code: '42703',
      message: 'column courses.courseware_url does not exist',
    }),
    /写入课程失败: 42703: column courses\.courseware_url does not exist/,
  );
});

test('does not throw when course writes succeed', () => {
  assert.doesNotThrow(() => assertCourseWriteSucceeded(null));
});
