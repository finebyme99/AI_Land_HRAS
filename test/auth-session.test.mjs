import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  AUTH_SESSION_MAX_AGE_DAYS,
  AUTH_SESSION_MAX_AGE_SECONDS,
  getAuthSessionCookieOptions,
} from '../src/lib/auth-session.ts';

test('auth session cookies last for 30 days', () => {
  assert.equal(AUTH_SESSION_MAX_AGE_DAYS, 30);
  assert.equal(AUTH_SESSION_MAX_AGE_SECONDS, 60 * 60 * 24 * 30);
});

test('auth session cookie options keep login for 30 days', () => {
  assert.deepEqual(getAuthSessionCookieOptions({ httpOnly: true, secure: true }), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  });

  assert.deepEqual(getAuthSessionCookieOptions({ httpOnly: false, secure: false }), {
    httpOnly: false,
    secure: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  });
});
