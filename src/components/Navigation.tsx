'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Drawer, Avatar, Dropdown } from 'antd';
import {
  HomeOutlined,
  BookOutlined,
  TrophyOutlined,
  ReadOutlined,
  AppstoreOutlined,
  UserOutlined,
  MenuOutlined,
  BellOutlined,
  LogoutOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';

const navItems = [
  { key: '/', label: '首页', icon: <HomeOutlined /> },
  { key: '/cases', label: 'HRAS案例库', icon: <BookOutlined /> },
  { key: '/competitions', label: 'AI大赛', icon: <TrophyOutlined /> },
  { key: '/courses', label: '公开课', icon: <ReadOutlined /> },
  { key: '/apps', label: '工具推荐', icon: <AppstoreOutlined /> },
];

const userMenuItems = [
  { key: '/profile', label: '个人中心' },
  { key: '/profile/contributions', label: '我的贡献' },
  { key: '/profile/bookmarks', label: '我的收藏' },
  { key: '/profile/notifications', label: '消息通知' },
  { key: '/profile/settings', label: '个人设置' },
];

export default function Navigation() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, loading, isAdmin, isReviewer, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/login';
  };

  return (
    <>
      {/* Desktop Navigation */}
      <header className="hidden md:block sticky top-0 z-50"
        style={{
          background: 'rgba(255, 255, 255, 0.5)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.7)',
        }}
      >
        <div className="max-w-[1100px] mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <img src="/hras-logo.png" alt="HRAS" className="h-5 w-auto object-contain" />
            <span className="text-xl font-extrabold tracking-tight">
              <span className="gradient-text">HRAS</span>
              <span style={{ color: 'var(--foreground)' }}> AI岛</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const active = pathname === item.key || (item.key !== '/' && pathname.startsWith(item.key));
              return (
                <Link
                  key={item.key}
                  href={item.key}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-all duration-200"
                  style={{
                    borderRadius: 'var(--radius-pill)',
                    color: active ? 'var(--primary)' : 'var(--text-secondary)',
                    background: active ? 'rgba(26, 58, 138, 0.08)' : 'transparent',
                    border: active ? '1px solid rgba(26, 58, 138, 0.15)' : '1px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.color = 'var(--primary)';
                      e.currentTarget.style.background = 'rgba(26, 58, 138, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(26, 58, 138, 0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.color = 'var(--text-secondary)';
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = 'transparent';
                    }
                  }}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {loading ? null : user ? (
            <>
              <Link href="/profile/notifications" className="p-2 rounded-full hover:opacity-70 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
                <BellOutlined style={{ fontSize: 18 }} />
              </Link>
              <Dropdown
                menu={{
                  items: [
                    ...userMenuItems.map((item) => ({
                      key: item.key,
                      label: <Link href={item.key}>{item.label}</Link>,
                    })),
                    ...(isAdmin || isReviewer ? [
                      {
                        key: 'admin',
                        label: '管理后台',
                        icon: <TeamOutlined />,
                        children: [
                          ...(isReviewer ? [{ key: '/admin/reviews', label: <Link href="/admin/reviews">评审管理</Link> }] : []),
                          ...(isAdmin ? [{ key: '/admin/reviews-overview', label: <Link href="/admin/reviews-overview">评审一览</Link> }] : []),
                          ...(isAdmin ? [
                            { key: '/admin/review', label: <Link href="/admin/review">内容审核</Link> },
                            { key: '/admin/users', label: <Link href="/admin/users">用户管理</Link> },
                            { key: '/admin/reminders', label: <Link href="/admin/reminders">提醒管理</Link> },
                            { key: '/admin/push', label: <Link href="/admin/push">飞书推送</Link> },
                            { key: '/admin/feishu-apps', label: <Link href="/admin/feishu-apps">飞书应用配置</Link> },
                            { key: '/admin/settings', label: <Link href="/admin/settings">平台设置</Link> },
                          ] : []),
                        ],
                      },
                    ] : []),
                    { type: 'divider' as const },
                    { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: handleLogout },
                  ],
                }}
                placement="bottomRight"
              >
                <div className="flex items-center gap-2 cursor-pointer py-1.5 px-2.5 transition-all"
                  style={{ borderRadius: 'var(--radius-pill)', border: '1px solid rgba(255, 255, 255, 0.6)', background: 'rgba(255, 255, 255, 0.4)' }}>
                  <Avatar src={user.avatar || undefined} icon={<UserOutlined />} size="small" />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user.name}</span>
                </div>
              </Dropdown>
            </>
          ) : (
            <Link href="/login" className="btn-gradient text-sm">
              登录
            </Link>
          )}
        </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <header className="flex md:hidden items-center justify-between px-4 h-12 sticky top-0 z-50"
        style={{
          background: 'rgba(255, 255, 255, 0.55)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.7)',
        }}
      >
        <button onClick={() => setDrawerOpen(true)} style={{ color: 'var(--text-secondary)' }}>
          <MenuOutlined style={{ fontSize: 18 }} />
        </button>
        <Link href="/" className="flex items-center gap-1.5">
          <img src="/hras-logo.png" alt="HRAS" className="h-4 w-auto object-contain" />
          <span className="text-base font-extrabold tracking-tight">
            <span className="gradient-text">HRAS</span>
            <span style={{ color: 'var(--foreground)' }}> AI岛</span>
          </span>
        </Link>
        {user ? (
          <Link href="/profile/notifications" style={{ color: 'var(--text-secondary)' }}>
            <BellOutlined style={{ fontSize: 18 }} />
          </Link>
        ) : (
          <Link href="/login" className="text-xs font-medium px-3 py-1" style={{ color: '#fff', background: 'var(--gradient-primary)', borderRadius: 'var(--radius-pill)' }}>登录</Link>
        )}
      </header>

      {/* Mobile Drawer */}
      <Drawer
        title={
          <span className="flex items-center gap-2">
            <img src="/hras-logo.png" alt="HRAS" className="h-5 w-auto object-contain" />
            <span style={{ fontWeight: 700 }}>
              <span className="gradient-text">HRAS</span>
              <span style={{ color: 'var(--foreground)' }}> AI岛</span>
            </span>
          </span>
        }
        placement="left"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        styles={{ body: { padding: '12px 0' } }}
      >
        {user && (
          <div className="flex items-center gap-3 mb-4 pb-4 px-4" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.5)' }}>
            <Avatar src={user.avatar || undefined} icon={<UserOutlined />} />
            <div>
              <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{user.name}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{user.department}</div>
            </div>
          </div>
        )}
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          items={[
            ...navItems.map((item) => ({
              key: item.key,
              icon: item.icon,
              label: <Link href={item.key} onClick={() => setDrawerOpen(false)}>{item.label}</Link>,
            })),
            { type: 'divider' as const },
            ...(user
              ? [
                  ...userMenuItems.map((item) => ({
                    key: item.key,
                    label: <Link href={item.key} onClick={() => setDrawerOpen(false)}>{item.label}</Link>,
                  })),
                  ...(isAdmin || isReviewer ? [
                    {
                      key: 'admin',
                      label: '管理后台',
                      icon: <TeamOutlined />,
                      children: [
                        ...(isReviewer ? [{ key: '/admin/reviews', label: <Link href="/admin/reviews" onClick={() => setDrawerOpen(false)}>评审管理</Link> }] : []),
                        ...(isAdmin ? [{ key: '/admin/reviews-overview', label: <Link href="/admin/reviews-overview" onClick={() => setDrawerOpen(false)}>评审一览</Link> }] : []),
                        ...(isAdmin ? [
                          { key: '/admin/review', label: <Link href="/admin/review" onClick={() => setDrawerOpen(false)}>内容审核</Link> },
                          { key: '/admin/users', label: <Link href="/admin/users" onClick={() => setDrawerOpen(false)}>用户管理</Link> },
                          { key: '/admin/reminders', label: <Link href="/admin/reminders" onClick={() => setDrawerOpen(false)}>提醒管理</Link> },
                          { key: '/admin/push', label: <Link href="/admin/push" onClick={() => setDrawerOpen(false)}>飞书推送</Link> },
                          { key: '/admin/feishu-apps', label: <Link href="/admin/feishu-apps" onClick={() => setDrawerOpen(false)}>飞书应用配置</Link> },
                          { key: '/admin/settings', label: <Link href="/admin/settings" onClick={() => setDrawerOpen(false)}>平台设置</Link> },
                        ] : []),
                      ],
                    },
                  ] : []),
                  { type: 'divider' as const } as const,
                  { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: handleLogout },
                ]
              : [{ key: 'login', label: <Link href="/login" onClick={() => setDrawerOpen(false)}>登录</Link> }]
            ),
          ]}
        />
      </Drawer>

      {/* Mobile Bottom Tab Bar */}
      <nav className="flex md:hidden items-center justify-around fixed bottom-0 left-0 right-0 z-50"
        style={{
          height: 56,
          background: 'rgba(255, 255, 255, 0.55)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.7)',
        }}
      >
        {navItems.slice(0, 5).map((item) => {
          const active = pathname === item.key;
          return (
            <Link
              key={item.key}
              href={item.key}
              className="flex flex-col items-center gap-0.5 text-xs transition-colors"
              style={{ color: active ? 'var(--primary)' : 'var(--text-muted)' }}
            >
              <span className="text-base">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
