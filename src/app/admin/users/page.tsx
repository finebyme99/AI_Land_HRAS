'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Table, Avatar, Tag, Select, Input, Spin, message } from 'antd';
import { UserOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import type { User } from '@/types';
import type { ColumnsType } from 'antd/es/table';

const roleOptions = [
  { value: 'user', label: '普通用户' },
  { value: 'contributor', label: '贡献者' },
  { value: 'reviewer', label: '评委' },
  { value: 'moderator', label: '版主' },
  { value: 'admin', label: '管理员' },
];

const roleColors: Record<string, string> = {
  admin: 'red',
  moderator: 'orange',
  reviewer: 'purple',
  contributor: 'green',
  user: 'default',
};

const roleLabels: Record<string, string> = {
  admin: '管理员',
  moderator: '版主',
  reviewer: '评委',
  contributor: '贡献者',
  user: '用户',
};

const levelColors: Record<string, string> = {
  'AI新手': 'default',
  'AI探索者': 'blue',
  'AI达人': 'purple',
  'AI专家': 'gold',
};

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace('/');
    }
  }, [authLoading, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('获取失败');
      const data = await res.json();
      setUsers(data.users);
    } catch {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRolesChange = async (userId: string, roles: string[]) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, roles }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '修改失败');
      }
      const data = await res.json();
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, roles: data.user.roles } : u))
      );
      message.success('角色修改成功');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '修改失败';
      message.error(msg);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.department?.toLowerCase().includes(search.toLowerCase())
  );

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const columns: ColumnsType<User> = [
    {
      title: '用户',
      key: 'user',
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <Avatar src={record.avatar} icon={<UserOutlined />} />
          <div>
            <div className="font-medium text-sm">{record.name}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{record.department || '未设置部门'}</div>
          </div>
        </div>
      ),
    },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      width: 220,
      render: (roles: string[], record) => (
        <Select
          mode="multiple"
          value={roles}
          size="small"
          style={{ width: 200 }}
          options={roleOptions}
          onChange={(val) => handleRolesChange(record.id, val)}
          disabled={record.id === user?.id}
          maxTagCount="responsive"
        />
      ),
    },
    {
      title: '等级',
      dataIndex: 'level',
      key: 'level',
      width: 120,
      render: (level: string) => (
        <Tag color={levelColors[level] || 'default'}>{level}</Tag>
      ),
    },
    {
      title: '积分',
      dataIndex: 'points',
      key: 'points',
      width: 80,
      sorter: (a, b) => a.points - b.points,
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (val: string) => new Date(val).toLocaleDateString('zh-CN'),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: '标签',
      key: 'tags',
      width: 160,
      render: (_, record) => (
        <div className="flex flex-wrap gap-1">
          {(record.roles ?? []).map((r) => (
            <Tag key={r} color={roleColors[r]}>{roleLabels[r] ?? r}</Tag>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold">用户管理</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              共 {users.length} 位注册用户
            </p>
          </div>
          <Input
            placeholder="搜索姓名或部门"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 280 }}
            allowClear
          />
        </div>

        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 人` }}
          scroll={{ x: 700 }}
        />
      </div>
    </div>
  );
}
