import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('competition detail card shows landing owners and hides legacy participant fields', () => {
  const source = readFileSync('src/app/competitions/page.tsx', 'utf8');
  const modalStart = source.indexOf('function EntryDrillDownModal');
  const modalEnd = source.indexOf('// ── 亮点项目卡片 ──');
  assert.ok(modalStart > -1);
  assert.ok(modalEnd > modalStart);

  const modalSource = source.slice(modalStart, modalEnd);

  assert.equal(modalSource.includes("fieldRow('提报人'"), false);
  assert.equal(modalSource.includes("wideRow('团队成员'"), false);
  assert.equal(modalSource.includes("labelWithTip('一句话简介'"), false);

  assert.equal(modalSource.includes("FIELD_LABELS.bizOwner"), true);
  assert.equal(modalSource.includes("FIELD_LABELS.aiOwner"), true);
});

test('competition detail card falls back to operation frequency source fields', () => {
  const source = readFileSync('src/app/competitions/page.tsx', 'utf8');
  assert.equal(source.includes('function formatOperationFrequency'), true);
  assert.equal(source.includes("normalizedFrequency.includes('每天')"), true);
  assert.equal(source.includes('formatOperationFrequency(item.beforeFreq, item.beforeFrequency, item.beforeOperationCount)'), true);
  assert.equal(source.includes('formatOperationFrequency(item.afterFreq, item.afterFrequency, item.afterOperationCount)'), true);
});

test('competition spotlight cards show landing contacts instead of participant names', () => {
  const source = readFileSync('src/app/competitions/page.tsx', 'utf8');
  const cardStart = source.indexOf('function SpotlightCard');
  const cardEnd = source.indexOf('// ── 指标卡', cardStart);
  assert.ok(cardStart > -1);
  assert.ok(cardEnd > cardStart);

  const cardSource = source.slice(cardStart, cardEnd);

  assert.equal(cardSource.includes('item.bizOwner'), true);
  assert.equal(cardSource.includes('item.aiOwner'), true);
  assert.equal(cardSource.includes('item.submitter'), false);
  assert.equal(cardSource.includes('item.teamMembers'), false);
});

test('competition spotlight card contact chips render Feishu avatars', () => {
  const source = readFileSync('src/app/competitions/page.tsx', 'utf8');
  const contactSource = readFileSync('src/components/PersonContactDisplay.tsx', 'utf8');
  const cardStart = source.indexOf('function SpotlightCard');
  const cardEnd = source.indexOf('// ── 指标卡', cardStart);
  assert.ok(cardStart > -1);
  assert.ok(cardEnd > cardStart);

  const cardSource = source.slice(cardStart, cardEnd);

  assert.equal(contactSource.includes('showAvatar'), true);
  assert.equal(contactSource.includes('src={profile.avatarUrl}'), true);
  assert.equal(cardSource.includes('showAvatar'), true);
});

test('owner contact display omits department and uses unavailable copy with space separated names', () => {
  const contactSource = readFileSync('src/components/PersonContactDisplay.tsx', 'utf8');
  const wishPoolSource = readFileSync('src/app/wish-pool/page.tsx', 'utf8');
  const detailBlockSource = readFileSync('src/components/DetailListBlock.tsx', 'utf8');

  assert.equal(contactSource.includes("PERSON_PROFILE_UNAVAILABLE_TEXT = '无权限/暂无资料'"), true);
  assert.equal(contactSource.includes('label="部门"'), false);
  assert.equal(contactSource.includes(".join(' ')"), true);
  assert.equal(contactSource.includes('、'), false);

  assert.equal(wishPoolSource.includes('PersonContactNames'), true);
  assert.equal(detailBlockSource.includes('personContactPlainText'), true);
});
