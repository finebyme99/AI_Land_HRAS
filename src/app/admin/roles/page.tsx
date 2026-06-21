'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  App,
  Button,
  Checkbox,
  Input,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import { getPermissionsByGroup, type PermissionDef } from '@/lib/permissions/registry';
import UserAuthorizationTab from './UserAuthorizationTab';
import type { RoleWithStats } from '@/types';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;
type TabKey = 'list' | 'matrix' | 'users';

export default function AdminRolesPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { hasPermission, loading: authLoading } = useAuth();
  const canViewRoles = hasPermission('admin.roles');
  const canViewUsers = hasPermission('admin.users');
  const canView = canViewRoles || canViewUsers;

  const [roles, setRoles] = useState<RoleWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('list');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ key: '', label: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [matrixDraft, setMatrixDraft] = useState<Record<string, Set<string>>>({});
  const [savingMatrix, setSavingMatrix] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/roles');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '获取失败');

      const nextRoles = (data.roles ?? []) as RoleWithStats[];
      setRoles(nextRoles);

      const draft: Record<string, Set<string>> = {};
      for (const role of nextRoles) {
        if (role.key !== 'admin') {
          draft[role.key] = new Set(role.permissions);
        }
      }
      setMatrixDraft(draft);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '获取角色列表失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    if (!authLoading && !canView) router.replace('/');
  }, [authLoading, canView, router]);

  useEffect(() => {
    if (!canViewRoles) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void fetchRoles();
    });
    return () => {
      cancelled = true;
    };
  }, [canViewRoles, fetchRoles]);

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    const allowedTabs: TabKey[] = [
      ...(canViewRoles ? (['list', 'matrix'] as TabKey[]) : []),
      ...(canViewUsers ? (['users'] as TabKey[]) : []),
    ];
    queueMicrotask(() => {
      if (cancelled) return;
      const requestedTab = new URLSearchParams(window.location.search).get('tab') as TabKey | null;
      setActiveTab(requestedTab && allowedTabs.includes(requestedTab) ? requestedTab : allowedTabs[0]);
    });
    return () => {
      cancelled = true;
    };
  }, [canView, canViewRoles, canViewUsers]);

  const handleCreate = async () => {
    if (!createForm.key.trim() || !createForm.label.trim()) {
      message.warning('key 和名称必填');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '创建失败');

      message.success('角色创建成功');
      setCreateModalOpen(false);
      setCreateForm({ key: '', label: '', description: '' });
      await fetchRoles();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (key: string) => {
    try {
      const res = await fetch(`/api/admin/roles/${key}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '删除失败');

      message.success('角色已删除');
      await fetchRoles();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const togglePermission = (roleKey: string, permissionKey: string) => {
    setMatrixDraft((prev) => {
      const current = new Set(prev[roleKey] ?? []);
      if (current.has(permissionKey)) {
        current.delete(permissionKey);
      } else {
        current.add(permissionKey);
      }
      return { ...prev, [roleKey]: current };
    });
  };

  const togglePermissionGroup = (roleKey: string, permissions: PermissionDef[], checked: boolean) => {
    setMatrixDraft((prev) => {
      const current = new Set(prev[roleKey] ?? []);
      for (const permission of permissions) {
        if (checked) {
          current.add(permission.key);
        } else {
          current.delete(permission.key);
        }
      }
      return { ...prev, [roleKey]: current };
    });
  };

  const handleSaveMatrix = async () => {
    setSavingMatrix(true);
    try {
      for (const [roleKey, permissionSet] of Object.entries(matrixDraft)) {
        const res = await fetch(`/api/admin/roles/${roleKey}/permissions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissionKeys: [...permissionSet] }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `保存 ${roleKey} 失败`);
      }

      message.success('权限矩阵已保存');
      await fetchRoles();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSavingMatrix(false);
    }
  };

  if (authLoading || !canView) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  const roleColumns: ColumnsType<RoleWithStats> = [
    {
      title: '角色 key',
      dataIndex: 'key',
      key: 'key',
      width: 150,
      render: (value: string) => <code>{value}</code>,
    },
    { title: '名称', dataIndex: 'label', key: 'label', width: 140 },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (value: string | null) => value || '-',
    },
    {
      title: '权限点',
      dataIndex: 'permission_count',
      key: 'permission_count',
      width: 90,
      align: 'center',
    },
    {
      title: '用户数',
      dataIndex: 'user_count',
      key: 'user_count',
      width: 90,
      align: 'center',
    },
    {
      title: '类型',
      dataIndex: 'is_system',
      key: 'is_system',
      width: 90,
      render: (isSystem: boolean) => (isSystem ? <Tag color="blue">系统</Tag> : <Tag>自定义</Tag>),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setActiveTab('matrix');
              router.replace('/admin/roles?tab=matrix', { scroll: false });
            }}
          >
            编辑权限
          </Button>
          {!record.is_system && (
            <Popconfirm
              title="确认删除该角色？"
              okText="删除"
              cancelText="取消"
              onConfirm={() => handleDelete(record.key)}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const groupedPermissions = getPermissionsByGroup();
  const editableRoles = roles.filter((role) => role.key !== 'admin');
  const allowedTabs: TabKey[] = [
    ...(canViewRoles ? (['list', 'matrix'] as TabKey[]) : []),
    ...(canViewUsers ? (['users'] as TabKey[]) : []),
  ];
  const visibleActiveTab = allowedTabs.includes(activeTab) ? activeTab : allowedTabs[0];

  const handleTabChange = (key: string) => {
    const nextTab = key as TabKey;
    setActiveTab(nextTab);
    router.replace(nextTab === 'list' ? '/admin/roles' : `/admin/roles?tab=${nextTab}`, { scroll: false });
  };

  const matrix = (
    <div>
      <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(26, 58, 138, 0.04)', border: '1px solid rgba(26, 58, 138, 0.1)' }}>
        <Text type="secondary">
          admin 角色默认拥有全部权限。勾选功能模块会默认勾选该模块下全部菜单页面和功能按钮；权限变更保存后，用户刷新页面即可生效。
        </Text>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: Math.max(860, 460 + editableRoles.length * 132) }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)', width: 320 }}>权限点</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)', width: 120 }}>权限类型</th>
              {editableRoles.map((role) => (
                <th key={role.key} style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)', minWidth: 132 }}>
                  <div>{role.label}</div>
                  <Text type="secondary" style={{ fontSize: 11 }}>{role.key}</Text>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedPermissions).map(([group, permissions]) => (
              <PermissionGroupRows
                key={group}
                group={group}
                permissions={permissions}
                roles={editableRoles}
                matrixDraft={matrixDraft}
                onToggle={togglePermission}
                onToggleGroup={togglePermissionGroup}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Button type="primary" icon={<SaveOutlined />} loading={savingMatrix} onClick={handleSaveMatrix}>
          保存权限矩阵
        </Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <h1 className="text-xl font-bold mb-1">用户权限</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          配置角色权限，并为用户授权系统角色和评委身份
        </p>

        <Tabs
          activeKey={visibleActiveTab}
          onChange={handleTabChange}
          items={[
            ...(canViewRoles ? [{
              key: 'list',
              label: '角色列表',
              children: (
                <>
                  <div className="mb-4">
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
                      新建角色
                    </Button>
                  </div>
                  <Table
                    columns={roleColumns}
                    dataSource={roles}
                    rowKey="key"
                    loading={loading}
                    pagination={false}
                    scroll={{ x: 900 }}
                  />
                </>
              ),
            },
            {
              key: 'matrix',
              label: '权限矩阵',
              children: loading ? <Spin /> : matrix,
            }] : []),
            ...(canViewUsers ? [{
              key: 'users',
              label: '用户授权',
              children: <UserAuthorizationTab />,
            }] : []),
          ]}
        />
      </div>

      <Modal
        title="新建角色"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => setCreateModalOpen(false)}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
      >
        <div className="mt-4 space-y-4">
          <div>
            <Text strong>角色 key</Text>
            <Input
              placeholder="content_ops"
              value={createForm.key}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, key: event.target.value }))}
              className="mt-1"
            />
            <Text type="secondary" style={{ fontSize: 12 }}>小写字母、数字、下划线，以字母开头</Text>
          </div>
          <div>
            <Text strong>显示名称</Text>
            <Input
              placeholder="内容运营"
              value={createForm.label}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, label: event.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <Text strong>描述</Text>
            <Input.TextArea
              placeholder="角色职责说明"
              value={createForm.description}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
              rows={2}
              className="mt-1"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function PermissionGroupRows({
  group,
  permissions,
  roles,
  matrixDraft,
  onToggle,
  onToggleGroup,
}: {
  group: string;
  permissions: PermissionDef[];
  roles: RoleWithStats[];
  matrixDraft: Record<string, Set<string>>;
  onToggle: (roleKey: string, permissionKey: string) => void;
  onToggleGroup: (roleKey: string, permissions: PermissionDef[], checked: boolean) => void;
}) {
  return (
    <>
      <tr style={{ background: 'rgba(26, 58, 138, 0.035)' }}>
        <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.05)', fontWeight: 600, fontSize: 13 }}>
          <div>{group}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>{permissions.length} 个下级权限</Text>
        </td>
        <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <PermissionTypeTag type="module" />
        </td>
        {roles.map((role) => {
          const checkedCount = permissions.filter((permission) => matrixDraft[role.key]?.has(permission.key)).length;
          const checked = checkedCount === permissions.length;
          const indeterminate = checkedCount > 0 && checkedCount < permissions.length;
          return (
            <td key={role.key} style={{ textAlign: 'center', padding: 6, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <Checkbox
                checked={checked}
                indeterminate={indeterminate}
                onChange={(event) => onToggleGroup(role.key, permissions, event.target.checked)}
              />
            </td>
          );
        })}
      </tr>
      {permissions.map((permission) => (
        <tr key={permission.key}>
          <td style={{ padding: '6px 12px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <div style={{ paddingLeft: 16 }}>{permission.label}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>{permission.key}</Text>
          </td>
          <td style={{ padding: '6px 12px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <PermissionTypeTag type={permission.kind} />
          </td>
          {roles.map((role) => {
            const checked = matrixDraft[role.key]?.has(permission.key) ?? false;
            return (
              <td key={role.key} style={{ textAlign: 'center', padding: 6, borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <Checkbox checked={checked} onChange={() => onToggle(role.key, permission.key)} />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function PermissionTypeTag({ type }: { type: 'module' | PermissionDef['kind'] }) {
  if (type === 'module') return <Tag color="geekblue">功能模块</Tag>;
  if (type === 'menu') return <Tag color="blue">菜单页面</Tag>;
  return <Tag color="orange">功能按钮</Tag>;
}
