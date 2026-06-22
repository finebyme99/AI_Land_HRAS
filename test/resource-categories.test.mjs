import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { RESOURCE_CATEGORIES } from '../src/types/index.ts';

test('resource categories include a highlighted Zongteng skills category', () => {
  assert.ok(RESOURCE_CATEGORIES.includes('纵腾人专属 Skills'));
});
