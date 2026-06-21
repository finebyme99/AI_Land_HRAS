'use client';

import { useCallback, useEffect, useState } from 'react';
import { Table, Avatar, Tag, Select, Input, Spin, App, Button, Modal, Form, Space, Tooltip } from 'antd';
import { UserOutlined, SearchOutlined, KeyOutlined, TeamOutlined, UserDeleteOutlined, CopyOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import type { User } from '@/types';
import type { ColumnsType } from 'antd/es/table';

const reviewerRoleLabels: Record<string, string> = {
  user: '用户评委',
  business: '业务评委',
  tech: '技术评委',
};

const reviewerRoleColors: Record<string, string> = {
  user: 'blue',
  business: 'orange',
  tech: 'green',
};

const levelColors: Record<string, string> = {
  'AI新手': 'default',
  'AI探索者': 'blue',
  'AI达人': 'purple',
  'AI专家': 'gold',
};

export default function UserAuthorizationTab() {
  const { message, modal } = App.useApp();
  const { user, hasPermission } = useAuth();
  const canSetRoles = hasPermission('user.set-roles');
  const canResetPassword = hasPermission('user.reset-password');
  const [users, setUsers] = useState<User[]>([]);
  const [roleOptions, setRoleOptions] = useState<{ value: string; label: string }[]>([
    { value: 'user', label: '普通用户' },
  ]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetUserName, setResetUserName] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [form] = Form.useForm();
  const [reviewerModalOpen, setReviewerModalOpen] = useState(false);
  const [reviewerModalRoles, setReviewerModalRoles] = useState<string[]>([]);

  const fetchUsers = useCallback(async () => {
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
  }, [message]);

  const fetchRoleOptions = useCallback(async () => {
    if (!canSetRoles) return;
    try {
      const res = await fetch('/api/admin/roles?scope=options');
      if (!res.ok) throw new Error('获取失败');
      const data = await res.json();
      setRoleOptions(
        (data.roles ?? []).map((role: { key: string; label: string }) => ({
          value: role.key,
          label: role.label,
        })),
      );
    } catch {
      message.error('获取角色选项失败');
    }
  }, [canSetRoles, message]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void fetchUsers();
      void fetchRoleOptions();
    });
    return () => {
      cancelled = true;
    };
  }, [fetchRoleOptions, fetchUsers]);

  const handleRolesChange = async (userId: string, roles: string[]) => {
    if (!canSetRoles) {
      message.error('无修改角色权限');
      return;
    }
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, roles: ['user', ...roles.filter((role) => role !== 'user')] }),
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

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const keywords = search.split(/[,，、\s]+/).filter(Boolean);
    return keywords.some((kw) => {
      const lower = kw.toLowerCase();
      return u.name.toLowerCase().includes(lower) || u.department?.toLowerCase().includes(lower) || u.employee_id?.toLowerCase().includes(lower);
    });
  });

  const handleBatchSetReviewerRoles = async () => {
    if (reviewerModalRoles.length === 0) {
      message.warning('请至少选择一个评委角色');
      return;
    }
    setBatchLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedRowKeys, action: 'set_reviewer_roles', reviewerRoles: reviewerModalRoles }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '操作失败');

      message.success(`分配评委角色完成：成功 ${data.success} 人，失败 ${data.failed} 人`);
      setSelectedRowKeys([]);
      setReviewerModalOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败';
      message.error(msg);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchClearReviewerRoles = () => {
    const selectedUsers = users.filter((u) => selectedRowKeys.includes(u.id));
    const withRoles = selectedUsers.filter((u) => u.reviewer_roles?.length).length;

    modal.confirm({
      title: '批量清除评委角色',
      content: (
        <div>
          <p>已选择 <strong>{selectedUsers.length}</strong> 位用户</p>
          <p>其中 <strong>{withRoles}</strong> 位当前有评委角色</p>
        </div>
      ),
      okText: '确认清除',
      cancelText: '取消',
      onOk: async () => {
        setBatchLoading(true);
        try {
          const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIds: selectedRowKeys, action: 'clear_reviewer_roles' }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '操作失败');

          message.success(`清除评委角色完成：成功 ${data.success} 人，失败 ${data.failed} 人`);
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
    if (!canResetPassword) {
      message.error('无重置密码权限');
      return;
    }
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  const columns: ColumnsType<User> = [
    {
      title: '用户',
      key: 'user',
      width: 220,
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <Avatar src={record.avatar || undefined} icon={<UserOutlined />} />
          <div>
            <div className="font-medium text-sm">{record.name}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {record.department || '未设置部门'}
              {record.employee_id ? ` · 工号 ${record.employee_id}` : ''}
            </div>
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
      title: '评委角色',
      key: 'reviewer_roles',
      width: 150,
      render: (_, record) => {
        const roles = record.reviewer_roles || [];
        if (roles.length === 0) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>-</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {roles.map((r) => (
              <Tag key={r} color={reviewerRoleColors[r] || 'default'}>{reviewerRoleLabels[r] || r}</Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: '系统角色',
      dataIndex: 'roles',
      key: 'roles',
      width: 220,
      render: (roles: string[], record) => (
        <Select
          mode="multiple"
          value={['user', ...(roles ?? []).filter((role) => role !== 'user')]}
          size="small"
          style={{ width: 200 }}
          options={roleOptions.map((option) => ({ ...option, disabled: option.value === 'user' }))}
          onChange={(val) => handleRolesChange(record.id, val)}
          disabled={record.id === user?.id || !canSetRoles}
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
      width: 120,
      render: (val: string) => new Date(val).toLocaleDateString('zh-CN'),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: '最近活跃',
      dataIndex: 'last_active_at',
      key: 'last_active_at',
      width: 120,
      render: (val: string | null) => val ? new Date(val).toLocaleDateString('zh-CN') : '-',
      sorter: (a, b) => new Date(a.last_active_at || 0).getTime() - new Date(b.last_active_at || 0).getTime(),
    },
    {
      title: '飞书 Open ID',
      key: 'feishu_id',
      width: 180,
      ellipsis: true,
      render: (_, record) => {
        if (!record.feishu_open_id) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>-</span>;
        const id = record.feishu_open_id;
        return (
          <Tooltip title={
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs">{id}</span>
              <CopyOutlined
                className="cursor-pointer hover:text-blue-400"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(id);
                  message.success('已复制');
                }}
              />
            </span>
          }>
            <span className="text-xs font-mono cursor-pointer hover:text-blue-500"
              onClick={() => {
                navigator.clipboard.writeText(id);
                message.success('已复制');
              }}>
              {id}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        record.username && canResetPassword ? (
          <Button
            type="link"
            size="small"
            icon={<KeyOutlined />}
            onClick={() => showResetModal(record.id, record.name)}
          >
            重置密码
          </Button>
        ) : (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{record.username ? '-' : '飞书登录'}</span>
        )
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold">用户授权</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            共 {users.length} 位注册用户，当前评委 {users.filter((u) => (u.reviewer_roles?.length ?? 0) > 0).length} 人
          </p>
        </div>
        <Space>
          <Input
            placeholder="搜索姓名/部门/工号（多个用逗号分隔）"
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
                onClick={() => { setReviewerModalRoles([]); setReviewerModalOpen(true); }}
              >
                分配评委角色
              </Button>
              <Button
                danger
                icon={<UserDeleteOutlined />}
                loading={batchLoading}
                onClick={handleBatchClearReviewerRoles}
              >
                清除评委角色
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
        pagination={{
          pageSize,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 人`,
          onChange: (_, size) => setPageSize(size),
        }}
        scroll={{ x: 1400 }}
      />

      <Modal
        title="分配评委角色"
        open={reviewerModalOpen}
        onOk={handleBatchSetReviewerRoles}
        onCancel={() => setReviewerModalOpen(false)}
        confirmLoading={batchLoading}
        okText="确认分配"
        cancelText="取消"
      >
        <div className="mt-4">
          <p className="mb-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            已选择 <strong>{selectedRowKeys.length}</strong> 位用户，请选择要分配的评委角色：
          </p>
          <Select
            mode="multiple"
            value={reviewerModalRoles}
            onChange={setReviewerModalRoles}
            style={{ width: '100%' }}
            placeholder="选择评委角色"
            options={[
              { value: 'user', label: '用户评委' },
              { value: 'business', label: '业务评委' },
              { value: 'tech', label: '技术评委' },
            ]}
          />
        </div>
      </Modal>

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
    </>
  );
}
