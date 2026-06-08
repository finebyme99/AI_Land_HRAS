'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Table, Avatar, Tag, Select, Input, Spin, App, Button, Modal, Form, Space } from 'antd';
import { UserOutlined, SearchOutlined, KeyOutlined, TeamOutlined, UserDeleteOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import type { User } from '@/types';
import type { ColumnsType } from 'antd/es/table';

const roleOptions = [
  { value: 'user', label: '普通用户' },
  { value: 'contributor', label: '贡献者' },
  { value: 'reviewer', label: '评委' },
  { value: 'course_admin', label: 'AI 课程管理员' },
  { value: 'moderator', label: '版主' },
  { value: 'admin', label: '管理员' },
];

const roleColors: Record<string, string> = {
  admin: 'red',
  moderator: 'orange',
  reviewer: 'purple',
  course_admin: 'blue',
  contributor: 'green',
  user: 'default',
};

const roleLabels: Record<string, string> = {
  admin: '管理员',
  moderator: '版主',
  reviewer: '评委',
  course_admin: 'AI 课程管理员',
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
  const { message, modal } = App.useApp();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetUserName, setResetUserName] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [form] = Form.useForm();

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

  const handleBatchAction = (action: 'add_reviewer' | 'remove_reviewer') => {
    const actionLabel = action === 'add_reviewer' ? '授予评委' : '清除评委';
    const selectedUsers = users.filter((u) => selectedRowKeys.includes(u.id));
    const reviewerCount = selectedUsers.filter((u) => u.roles?.includes('reviewer')).length;

    modal.confirm({
      title: `批量${actionLabel}`,
      content: (
        <div>
          <p>已选择 <strong>{selectedUsers.length}</strong> 位用户</p>
          {action === 'remove_reviewer' && (
            <p>其中 <strong>{reviewerCount}</strong> 位当前有评委角色</p>
          )}
          {action === 'add_reviewer' && (
            <p>其中 <strong>{selectedUsers.length - reviewerCount}</strong> 位将新增评委角色</p>
          )}
        </div>
      ),
      okText: `确认${actionLabel}`,
      cancelText: '取消',
      onOk: async () => {
        setBatchLoading(true);
        try {
          const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIds: selectedRowKeys, action }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '操作失败');

          message.success(`批量${actionLabel}完成：成功 ${data.success} 人，失败 ${data.failed} 人`);
          setSelectedRowKeys([]);
          fetchUsers();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '操作失败';
          message.error(msg);
        } finally {
          setBatchLoading(false);
        }
      },
    });
  };

  const showResetModal = (userId: string, userName: string) => {
    setResetUserId(userId);
    setResetUserName(userName);
    setResetModalOpen(true);
    form.resetFields();
  };

  const handleResetPassword = async () => {
    try {
      const values = await form.validateFields();
      setResetLoading(true);
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resetUserId, newPassword: values.newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '重置失败');
      }
      message.success(`已重置 ${resetUserName} 的密码`);
      setResetModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '重置失败';
      message.error(msg);
    } finally {
      setResetLoading(false);
    }
  };

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
          <Avatar src={record.avatar || undefined} icon={<UserOutlined />} />
          <div>
            <div className="font-medium text-sm">{record.name}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{record.department || '未设置部门'}</div>
          </div>
        </div>
      ),
    },
    {
      title: '来源',
      key: 'source',
      width: 100,
      render: (_, record) => (
        <Tag color={record.feishu_open_id ? 'blue' : 'default'}>
          {record.feishu_open_id ? '飞书用户' : '注册用户'}
        </Tag>
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
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        record.username ? (
          <Button
            type="link"
            size="small"
            icon={<KeyOutlined />}
            onClick={() => showResetModal(record.id, record.name)}
          >
            重置密码
          </Button>
        ) : (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>飞书登录</span>
        )
      ),
    },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold">用户管理</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              共 {users.length} 位注册用户，当前评委 {users.filter((u) => u.roles?.includes('reviewer')).length} 人
            </p>
          </div>
          <Space>
            <Input
              placeholder="搜索姓名或部门"
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 280 }}
              allowClear
            />
          </Space>
        </div>

        {selectedRowKeys.length > 0 && (
          <div className="mb-4 p-3 rounded-lg" style={{ background: 'var(--primary-bg, #f0f5ff)', border: '1px solid var(--primary-border, #d6e4ff)' }}>
            <div className="flex items-center justify-between">
              <span>已选择 <strong>{selectedRowKeys.length}</strong> 位用户</span>
              <Space>
                <Button
                  type="primary"
                  icon={<TeamOutlined />}
                  loading={batchLoading}
                  onClick={() => handleBatchAction('add_reviewer')}
                >
                  批量授予评委
                </Button>
                <Button
                  danger
                  icon={<UserDeleteOutlined />}
                  loading={batchLoading}
                  onClick={() => handleBatchAction('remove_reviewer')}
                >
                  批量清除评委
                </Button>
                <Button onClick={() => setSelectedRowKeys([])}>取消选择</Button>
              </Space>
            </div>
          </div>
        )}

        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as string[]),
          }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 人` }}
          scroll={{ x: 800 }}
        />
      </div>

      <Modal
        title={`重置密码 - ${resetUserName}`}
        open={resetModalOpen}
        onOk={handleResetPassword}
        onCancel={() => setResetModalOpen(false)}
        confirmLoading={resetLoading}
        okText="确认重置"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6位' },
            ]}
          >
            <Input.Password placeholder="请输入新密码（至少6位）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
