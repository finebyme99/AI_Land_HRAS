'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Drawer, Avatar, Dropdown } from 'antd';
import {
  DownOutlined,
  HomeOutlined,
  TrophyOutlined,
  ReadOutlined,
  UserOutlined,
  MenuOutlined,
  LogoutOutlined,
  StarOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';

const navItems = [
  { key: '/', label: '首页', icon: <HomeOutlined /> },
  { key: '/wish-pool', label: '场景大全', icon: <StarOutlined /> },
  { key: '/competitions', label: 'AI大赛', icon: <TrophyOutlined /> },
  { key: '/resources', label: '课程与资源', icon: <ReadOutlined /> },
  { key: '/profile', label: '个人中心', icon: <UserOutlined /> },
];

const adminMenuItems = [
  { key: '/admin/review', label: '内容审核' },
  { key: '/admin/roles', label: '用户权限' },
  { key: '/admin/bitable-field-map', label: '字段映射配置' },
  { key: '/admin/feishu-apps', label: '飞书应用配置' },
  { key: '/admin/operation-logs', label: '操作日志' },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, loading, isAdmin, signOut } = useAuth();

  // 根据权限过滤导航项
  const filteredNavItems = navItems;
  const adminActive = pathname.startsWith('/admin');

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
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
        <div className="px-[100px] h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <img src="/hras-logo.png" alt="HRAS" className="h-5 w-auto object-contain" />
            <span className="text-xl font-extrabold tracking-tight">
              <span className="gradient-text">HRAS</span>
              <span style={{ color: 'var(--foreground)' }}> AI岛</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {filteredNavItems.map((item) => {
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
            {isAdmin && (
              <Dropdown
                menu={{
                  items: adminMenuItems.map((item) => ({
                    key: item.key,
                    label: <Link href={item.key}>{item.label}</Link>,
                  })),
                }}
                placement="bottomRight"
              >
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer"
                  style={{
                    borderRadius: 'var(--radius-pill)',
                    color: adminActive ? 'var(--primary)' : 'var(--text-secondary)',
                    background: adminActive ? 'rgba(26, 58, 138, 0.08)' : 'transparent',
                    border: adminActive ? '1px solid rgba(26, 58, 138, 0.15)' : '1px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!adminActive) {
                      e.currentTarget.style.color = 'var(--primary)';
                      e.currentTarget.style.background = 'rgba(26, 58, 138, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(26, 58, 138, 0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!adminActive) {
                      e.currentTarget.style.color = 'var(--text-secondary)';
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = 'transparent';
                    }
                  }}
                >
                  <TeamOutlined />
                  管理后台
                  <DownOutlined style={{ fontSize: 10 }} />
                </button>
              </Dropdown>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {loading ? null : user ? (
            <>
              <Dropdown
                menu={{
                  items: [
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
          <Link href="/profile" style={{ color: 'var(--text-secondary)' }}>
            <UserOutlined style={{ fontSize: 18 }} />
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
            ...filteredNavItems.map((item) => ({
              key: item.key,
              icon: item.icon,
              label: <Link href={item.key} onClick={() => setDrawerOpen(false)}>{item.label}</Link>,
            })),
            ...(isAdmin
              ? [{
                  key: 'admin',
                  icon: <TeamOutlined />,
                  label: '管理后台',
                  children: adminMenuItems.map((item) => ({
                    key: item.key,
                    label: <Link href={item.key} onClick={() => setDrawerOpen(false)}>{item.label}</Link>,
                  })),
                }]
              : []),
            { type: 'divider' as const },
            ...(user
              ? [
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
        {filteredNavItems.slice(0, 5).map((item) => {
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
