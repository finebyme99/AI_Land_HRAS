import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { formatErrorMessage } from '../src/lib/format-error-message.ts';

test('formats Supabase object errors with code and message', () => {
  const message = formatErrorMessage({
    code: '42703',
    message: 'column users.feishu_tenant_key does not exist',
    hint: 'Perhaps you meant users.role',
  });

  assert.equal(
    message,
    '42703: column users.feishu_tenant_key does not exist (hint: Perhaps you meant users.role)',
  );
});

test('formats Error instances with their message', () => {
  assert.equal(formatErrorMessage(new Error('boom')), 'boom');
});
