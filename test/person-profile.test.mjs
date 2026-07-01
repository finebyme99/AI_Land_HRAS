import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('normalizes Feishu bitable person fields into stable person profiles', async () => {
  const { normalizeBitablePersonProfiles } = await import('../src/lib/person-profile.ts');

  const profiles = normalizeBitablePersonProfiles([
    {
      id: 'ou_abc',
      name: '张三',
      en_name: 'San Zhang',
      email: 'san@example.test',
      avatar_url: 'https://example.test/avatar.png',
    },
  ]);

  assert.deepEqual(profiles, [
    {
      name: '张三',
      enName: 'San Zhang',
      openId: 'ou_abc',
      email: 'san@example.test',
      avatarUrl: 'https://example.test/avatar.png',
    },
  ]);
});

test('merges Feishu contact details and local user metadata by open id', async () => {
  const { mergePersonProfileDetails } = await import('../src/lib/person-profile.ts');

  const [profile] = mergePersonProfileDetails(
    [{ name: '张三', openId: 'ou_abc' }],
    new Map([
      ['ou_abc', { userId: 'u_abc', employeeId: 'zt12345', jobTitle: '流程专家' }],
    ]),
    new Map([
      ['ou_abc', { department: 'HRSSC', employeeId: 'zt-local' }],
    ]),
  );

  assert.deepEqual(profile, {
    name: '张三',
    openId: 'ou_abc',
    userId: 'u_abc',
    employeeId: 'zt12345',
    department: 'HRSSC',
    jobTitle: '流程专家',
  });
});

test('builds a Feishu chat applink from open id', async () => {
  const { buildFeishuChatUrl } = await import('../src/lib/person-profile.ts');

  assert.equal(
    buildFeishuChatUrl('ou_abc'),
    'https://applink.feishu.cn/client/chat/open?openId=ou_abc',
  );
  assert.equal(buildFeishuChatUrl(undefined), null);
});

test('competition owner profile migration adds structured JSONB columns', () => {
  const source = readFileSync('supabase/migrations/076_competition_owner_profiles.sql', 'utf8');

  assert.match(source, /biz_owner_profiles JSONB/);
  assert.match(source, /ai_owner_profiles JSONB/);
});
