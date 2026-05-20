'use client';

import Link from 'next/link';
import { Avatar, Tag, Spin } from 'antd';
import {
  UserOutlined,
  BookOutlined,
  StarOutlined,
  BellOutlined,
  SettingOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';

export default function ProfilePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="text-center py-16 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <UserOutlined className="text-4xl mb-4" style={{ color: 'var(--text-muted)' }} />
          <p className="mb-4" style={{ color: 'var(--text-muted)' }}>请先登录</p>
          <Link href="/login" className="text-sm font-medium px-4 py-2 rounded-lg" style={{ color: 'var(--primary)', background: 'rgba(184, 92, 56, 0.06)' }}>
            去登录
          </Link>
        </div>
      </div>
    );
  }

  const menuItems = [
    { key: '/profile/contributions', label: '我的贡献', icon: <BookOutlined />, desc: '查看你发布的案例' },
    { key: '/profile/bookmarks', label: '我的收藏', icon: <StarOutlined />, desc: '收藏的内容' },
    { key: '/profile/notifications', label: '消息通知', icon: <BellOutlined />, desc: '系统通知与互动' },
    { key: '/profile/settings', label: '个人设置', icon: <SettingOutlined />, desc: '账号信息管理' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Profile card */}
      <div className="rounded-2xl p-6 sm:p-8 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-center gap-4 mb-6">
          <Avatar size={72} src={user.avatar} icon={<UserOutlined />}
            style={{ border: '3px solid var(--border-light)' }} />
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-serif)' }}>{user.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{user.department || '未设置部门'}</p>
            <Tag color="blue" className="mt-1">{user.level}</Tag>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg" style={{ background: 'var(--background)' }}>
            <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary)' }}>{user.points}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>积分</div>
          </div>
          <div className="text-center p-3 rounded-lg" style={{ background: 'var(--background)' }}>
            <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-serif)', color: 'var(--accent)' }}>{user.level}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>等级</div>
          </div>
          <div className="text-center p-3 rounded-lg" style={{ background: 'var(--background)' }}>
            <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-serif)', color: '#7850a0' }}>{user.role === 'admin' ? '管理员' : '用户'}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>角色</div>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {menuItems.map((item) => (
          <Link key={item.key} href={item.key} className="block group">
            <div className="rounded-xl p-5 transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <span className="w-10 h-10 rounded-lg flex items-center justify-center text-base"
                style={{ background: 'rgba(184, 92, 56, 0.06)', color: 'var(--primary)' }}>
                {item.icon}
              </span>
              <div className="flex-1">
                <div className="font-medium text-sm">{item.label}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.desc}</div>
              </div>
              <ArrowRightOutlined className="group-hover:opacity-70 transition-opacity" style={{ color: 'var(--text-muted)', fontSize: 12 }} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
