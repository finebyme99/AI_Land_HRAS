import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');

const navigation = read('src/components/Navigation.tsx');
const registry = read('src/lib/permissions/registry.ts');
const profile = read('src/app/profile/page.tsx');

const removedAdminMenus = [
  ['admin.reviews', '评审管理'],
  ['admin.layouts', '方案卡片布局'],
  ['admin.reminders', '提醒管理'],
  ['admin.push', '飞书推送'],
  ['admin.settings', '平台设置'],
];

const removedActionPermissions = [
  'review.export',
  'review.sync-feishu',
  'review.clear-reviewer',
  'reminder.send',
  'push.send',
  'layout.edit',
  'settings.save',
];

const activeAdminMenus = [
  ['admin.review', '内容审核'],
  ['admin.users', '用户授权'],
  ['admin.roles', '用户权限'],
  ['admin.bitable-field-map', '字段映射配置'],
  ['admin.feishu-apps', '飞书应用配置'],
];

const failures = [];

for (const [key, label] of removedAdminMenus) {
  if (navigation.includes(key) || navigation.includes(label)) {
    failures.push(`Navigation still exposes removed admin menu ${label} (${key}).`);
  }
  if (registry.includes(`key: '${key}'`) || registry.includes(`label: '${label}'`)) {
    failures.push(`Permission registry still exposes removed admin menu ${label} (${key}).`);
  }
}

for (const key of removedActionPermissions) {
  if (registry.includes(`key: '${key}'`)) {
    failures.push(`Permission registry still exposes removed action permission ${key}.`);
  }
}

for (const [key, label] of activeAdminMenus) {
  if (!registry.includes(`key: '${key}'`) || !registry.includes(`label: '${label}'`)) {
    failures.push(`Permission registry is missing active admin menu ${label} (${key}).`);
  }
}

if (!registry.includes("key: 'resource.generate-feishu-card'")) {
  failures.push('Permission registry must keep resource.generate-feishu-card for tool Feishu cards.');
}

for (const href of ['/profile/notifications', '/profile/settings']) {
  if (navigation.includes(`href="${href}"`) || navigation.includes(`key: '${href}'`)) {
    failures.push(`Global navigation still links to removed account entry ${href}.`);
  }
  if (profile.includes(`href="${href}"`) || profile.includes(href)) {
    failures.push(`Profile page still links to removed account entry ${href}.`);
  }
}

for (const path of ['src/app/profile/notifications/page.tsx', 'src/app/profile/settings/page.tsx']) {
  if (existsSync(join(root, path))) {
    failures.push(`Removed account page still exists: ${path}.`);
  }
}

if (profile.includes('账户入口') || profile.includes('AccountAction') || profile.includes('管理后台')) {
  failures.push('Profile page must not expose account settings, notifications, or admin entry cards.');
}

if (!navigation.includes('isAdmin') || !navigation.includes('管理后台')) {
  failures.push('Navigation must expose a standalone admin-only 管理后台 module.');
}

const adminLinks = [
  ['/admin/review', '内容审核'],
  ['/admin/roles', '用户权限'],
  ['/admin/bitable-field-map', '字段映射配置'],
  ['/admin/feishu-apps', '飞书应用配置'],
];

for (const [href, label] of adminLinks) {
  if (!navigation.includes(href) || !navigation.includes(label)) {
    failures.push(`Navigation admin module is missing ${label} (${href}).`);
  }
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('Menu and permission registry checks passed.');
