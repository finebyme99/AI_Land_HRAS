import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { assertCourseWriteSucceeded, buildCourseSyncRow } from '../src/lib/course-sync.ts';

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

test('builds course sync rows using feishu_record_id instead of uuid id', () => {
  const row = buildCourseSyncRow({
    feishuRecordId: 'rec27nvuYSFt02',
    title: 'AI工具入门实战',
    instructor: '郭谦',
    createdAt: '2026-05-10T00:00:00.000Z',
    videoUrl: 'https://example.com/video',
    coursewareUrl: 'https://example.com/doc',
    contentType: ['video', 'doc'],
    period: '01期',
    season: '第一季',
    coverImageKey: null,
  });

  assert.equal(row.feishu_record_id, 'rec27nvuYSFt02');
  assert.equal('id' in row, false);
});
