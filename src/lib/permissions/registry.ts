// 权限点注册表
// 所有权限点在代码内声明，DB 的 role_permissions 表只存「角色 × 权限点 key」的分配关系。
// 代码删除某权限点后，DB 残留的孤儿记录由权限解析层（index.ts）用 PERMISSION_KEYS 过滤掉。

export interface PermissionDef {
  key: string;
  label: string;
  group: string;
  kind: 'menu' | 'button';
  description?: string;
}

export const PERMISSIONS: PermissionDef[] = [
  // ===== 前台导航 =====
  { key: 'nav.home', label: '首页', group: '前台导航', kind: 'menu' },
  { key: 'nav.wish-pool', label: '场景大全', group: '前台导航', kind: 'menu' },
  { key: 'nav.competitions', label: 'AI大赛', group: '前台导航', kind: 'menu' },
  { key: 'nav.resources', label: '课程与资源', group: '前台导航', kind: 'menu' },
  { key: 'nav.profile', label: '个人中心', group: '前台导航', kind: 'menu' },

  // ===== 管理后台页面 =====
  { key: 'admin.reviews', label: '评审管理', group: '管理后台', kind: 'menu' },
  { key: 'admin.review', label: '内容审核', group: '管理后台', kind: 'menu' },
  { key: 'admin.users', label: '用户授权', group: '管理后台', kind: 'menu' },
  { key: 'admin.bitable-field-map', label: '字段映射配置', group: '管理后台', kind: 'menu' },
  { key: 'admin.layouts', label: '方案卡片布局', group: '管理后台', kind: 'menu' },
  { key: 'admin.reminders', label: '提醒管理', group: '管理后台', kind: 'menu' },
  { key: 'admin.push', label: '飞书推送', group: '管理后台', kind: 'menu' },
  { key: 'admin.feishu-apps', label: '飞书应用配置', group: '管理后台', kind: 'menu' },
  { key: 'admin.settings', label: '平台设置', group: '管理后台', kind: 'menu' },
  { key: 'admin.roles', label: '用户权限', group: '管理后台', kind: 'menu' },

  // ===== 课程模块 =====
  { key: 'course.sync', label: '课程同步飞书', group: '课程模块', kind: 'button' },
  { key: 'course.publish', label: '课程发布/编辑', group: '课程模块', kind: 'button' },

  // ===== 大赛评审 =====
  { key: 'review.score', label: '评审打分', group: '大赛评审', kind: 'button' },
  { key: 'review.export', label: '评审记录导出 CSV', group: '大赛评审', kind: 'button' },
  { key: 'review.sync-feishu', label: '评审进度同步飞书', group: '大赛评审', kind: 'button' },
  { key: 'review.clear-reviewer', label: '清空评委评分', group: '大赛评审', kind: 'button' },
  { key: 'competition.sync', label: '大赛数据同步飞书', group: '大赛评审', kind: 'button' },
  { key: 'dashboard.export-image', label: '效果看板导出图片', group: '大赛评审', kind: 'button' },

  // ===== 场景池 =====
  { key: 'case.feature', label: '标精选', group: '场景池', kind: 'button' },
  { key: 'case.submit', label: '提交案例', group: '场景池', kind: 'button' },
  { key: 'wishpool.export-image', label: '场景大全导出图片', group: '场景池', kind: 'button' },

  // ===== 资源 =====
  { key: 'resource.submit', label: '提交工具', group: '资源', kind: 'button' },
  { key: 'resource.generate-feishu-card', label: '生成飞书卡片', group: '资源', kind: 'button' },
  { key: 'resource.review', label: '内容审核通过/驳回', group: '资源', kind: 'button' },

  // ===== 用户授权 =====
  { key: 'user.reset-password', label: '重置密码', group: '用户授权', kind: 'button' },
  { key: 'user.set-roles', label: '修改他人角色', group: '用户授权', kind: 'button' },

  // ===== 字段映射 =====
  { key: 'fieldmap.sync', label: '字段映射同步飞书', group: '字段映射', kind: 'button' },

  // ===== 提醒 =====
  { key: 'reminder.send', label: '提醒发送', group: '提醒', kind: 'button' },

  // ===== 推送 =====
  { key: 'push.send', label: '飞书群推送', group: '推送', kind: 'button' },

  // ===== 布局 =====
  { key: 'layout.edit', label: '布局编辑保存', group: '布局', kind: 'button' },

  // ===== 飞书应用 =====
  { key: 'feishu-app.manage', label: '飞书应用增删改', group: '飞书应用', kind: 'button' },

  // ===== 平台设置 =====
  { key: 'settings.save', label: '平台设置保存', group: '平台设置', kind: 'button' },
];

export const PERMISSION_KEYS = new Set(PERMISSIONS.map((p) => p.key));

export function getPermissionsByGroup(): Record<string, PermissionDef[]> {
  const grouped: Record<string, PermissionDef[]> = {};
  for (const permission of PERMISSIONS) {
    grouped[permission.group] ??= [];
    grouped[permission.group].push(permission);
  }
  return grouped;
}

export function getPermissionLabel(key: string): string {
  return PERMISSIONS.find((permission) => permission.key === key)?.label ?? key;
}
