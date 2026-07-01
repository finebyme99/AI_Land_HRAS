import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { partitionProgressStates } from '../src/lib/bitable/enums.ts';

test('merged same-project progress is not counted as pending implementation', () => {
  const states = partitionProgressStates([
    { id: 'opt-1', name: '待启动', color: 0 },
    { id: 'opt-2', name: '开发验证中', color: 1 },
    { id: 'opt-3', name: '并入同类项目', color: 2 },
    { id: 'opt-4', name: '试点上线', color: 3 },
  ]);

  assert.deepEqual(states.landed, ['试点上线']);
  assert.deepEqual(states.pending, ['待启动', '开发验证中']);
});
