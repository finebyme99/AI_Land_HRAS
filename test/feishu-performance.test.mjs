import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { getTenantAccessTokenFor } from '../src/lib/feishu.ts';

test('getTenantAccessTokenFor reuses a valid token for the same app credentials', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async () => {
    calls++;
    return {
      async json() {
        return {
          code: 0,
          tenant_access_token: 'tenant-token-1',
          expire: 7200,
        };
      },
    };
  };

  try {
    const first = await getTenantAccessTokenFor('app-a', 'secret-a');
    const second = await getTenantAccessTokenFor('app-a', 'secret-a');

    assert.equal(first, 'tenant-token-1');
    assert.equal(second, 'tenant-token-1');
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('read-only scene and competition endpoints do not sync Feishu field schema on page load', () => {
  const routeFiles = [
    'src/app/api/wish-pool/route.ts',
    'src/app/api/competitions/progress/route.ts',
  ];

  for (const file of routeFiles) {
    const source = readFileSync(file, 'utf8');
    assert.equal(
      source.includes('syncFieldMapFromFeishu'),
      false,
      `${file} should not call syncFieldMapFromFeishu from GET`,
    );
  }
});
