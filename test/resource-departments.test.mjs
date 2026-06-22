import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  normalizeDepartmentInput,
  buildDepartmentOptions,
  getDepartmentDisplayValues,
  hasDepartmentSelection,
  normalizeDepartmentValues,
} from '../src/lib/resources/departments.ts';
import * as departmentHelpers from '../src/lib/resources/departments.ts';

test('normalizeDepartmentValues trims values and removes duplicates', () => {
  assert.deepEqual(
    normalizeDepartmentValues([' HR ', '', '财务', 'HR', null, undefined, '未填写']),
    ['HR', '财务'],
  );
});

test('normalizeDepartmentInput accepts API payloads and ignores invalid values', () => {
  assert.deepEqual(normalizeDepartmentInput(['HR', 1, ' HR ', null, false]), ['HR']);
  assert.deepEqual(normalizeDepartmentInput('供应链'), ['供应链']);
  assert.deepEqual(normalizeDepartmentInput({ value: 'HR' }), []);
});

test('hasDepartmentSelection rejects empty department payloads', () => {
  assert.equal(hasDepartmentSelection(['HR']), true);
  assert.equal(hasDepartmentSelection('HR'), true);
  assert.equal(hasDepartmentSelection([]), false);
  assert.equal(hasDepartmentSelection([' ', '未填写']), false);
  assert.equal(hasDepartmentSelection({ value: 'HR' }), false);
});

test('isAllDepartmentsSelected returns true only when current options are fully covered', () => {
  assert.equal(typeof departmentHelpers.isAllDepartmentsSelected, 'function');
  assert.equal(departmentHelpers.isAllDepartmentsSelected(['HR', '财务'], ['HR', '财务']), true);
  assert.equal(departmentHelpers.isAllDepartmentsSelected(['财务', 'HR', 'HR'], ['HR', '财务']), true);
  assert.equal(departmentHelpers.isAllDepartmentsSelected(['HR'], ['HR', '财务']), false);
  assert.equal(departmentHelpers.isAllDepartmentsSelected(['HR'], []), false);
});

test('getDepartmentDisplayValues collapses full coverage into all label', () => {
  assert.deepEqual(getDepartmentDisplayValues(['HR', '财务'], ['HR', '财务']), ['全部']);
  assert.deepEqual(getDepartmentDisplayValues(['HR'], ['HR', '财务']), ['HR']);
});

test('buildDepartmentOptions prefers field-map order and appends fallback teams', () => {
  const options = buildDepartmentOptions(
    [{ id: '1', name: 'HR' }, { id: '2', name: '财务' }, { id: '3', name: '' }],
    [['财务', '供应链'], ['HR'], ['未填写']],
  );

  assert.deepEqual(options, ['HR', '财务', '供应链']);
});
