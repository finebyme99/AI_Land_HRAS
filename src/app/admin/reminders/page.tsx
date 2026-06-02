'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table, Tag, Button, Modal, Form, Input, Select, Switch, App,
  Space, Popconfirm, TimePicker, Tooltip,
} from 'antd';
import {
  BellOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  SendOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import dayjs from 'dayjs';

interface UserOption {
  id: string;
  name: string;
  has_feishu: boolean;
  roles: string[];
}

interface ReminderItem {
  id: string;
  title: string;
  content: string;
  frequency: string;
  send_time: string;
  send_day: number | null;
  next_send_at: string | null;
  is_active: boolean;
  created_at: string;
  reminder_targets?: Array<{ id: string; user_id: string; users?: { name: string; feishu_open_id: string | null } }>;
  reminder_logs?: Array<{ id: string; status: string; sent_at: string }>;
}

const FREQUENCY_OPTIONS = [
  { value: 'once', label: '仅一次' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
];

const WEEKDAY_OPTIONS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
];

export default function AdminRemindersPage() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();
  const { message } = App.useApp();
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ReminderItem | null>(null);
  const [sending, setSending] = useState(false);
  const [form] = Form.useForm();

  const frequency = Form.useWatch('frequency', form);

  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/');
  }, [authLoading, isAdmin, router]);

  const fetchReminders = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/reminders');
      if (!res.ok) throw new Error('获取失败');
      const data = await res.json();
      setReminders(data.reminders || []);
    } catch {
      message.error('获取提醒列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/reminders/users');
      if (!res.ok) throw new Error('获取失败');
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      message.error('获取用户列表失败');
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchReminders();
      fetchUsers();
    }
  }, [isAdmin, fetchReminders, fetchUsers]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ frequency: 'once', send_time: dayjs('09:00', 'HH:mm') });
    setModalOpen(true);
  };

  const openEdit = (item: ReminderItem) => {
    setEditing(item);
    form.setFieldsValue({
      title: item.title,
      content: item.content,
      frequency: item.frequency,
      send_time: dayjs(item.send_time, 'HH:mm'),
      send_day: item.send_day,
      is_active: item.is_active,
      user_ids: item.reminder_targets?.map((t) => t.user_id) || [],
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const body = {
        title: values.title,
        content: values.content || '',
        frequency: values.frequency,
        send_time: values.send_time.format('HH:mm'),
        send_day: values.frequency === 'weekly' ? values.send_day : null,
        is_active: values.is_active ?? true,
        user_ids: values.user_ids || [],
      };

      const url = editing ? `/api/admin/reminders/${editing.id}` : '/api/admin/reminders';
      const method = editing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '操作失败');
      }

      message.success(editing ? '已更新' : '已创建');
      setModalOpen(false);
      fetchReminders();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/admin/reminders/${id}`, { method: 'DELETE' });
    if (!res.ok) { message.error('删除失败'); return; }
    message.success('已删除');
    fetchReminders();
  };

  const handleSend = async (dryRun: boolean) => {
    setSending(true);
    try {
      const res = await fetch(`/api/admin/reminders/send?dry_run=${dryRun}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '发送失败');

      if (dryRun) {
        Modal.info({
          title: '预览结果（未实际发送）',
          content: (
            <div>
              <p>到期提醒: {data.total} 条</p>
              <p>可发送: {data.sent} 条</p>
              <p>无飞书ID: {data.noFeishuId} 条</p>
              {data.details?.length > 0 && (
                <div className="mt-2 max-h-40 overflow-auto text-xs">
                  {data.details.map((d: any, i: number) => (
                    <div key={i}>{d.title} → {d.userId.slice(0, 8)}… [{d.status}]</div>
                  ))}
                </div>
              )}
            </div>
          ),
          width: 500,
        });
      } else {
        message.success(`发送完成: ${data.sent} 成功, ${data.failed} 失败, ${data.noFeishuId} 无飞书ID`);
        fetchReminders();
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '发送失败');
    } finally {
      setSending(false);
    }
  };

  const columns = [
    {
      title: '提醒标题',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: ReminderItem) => (
        <div>
          <span className="font-medium">{title}</span>
          {record.content && <div className="text-xs mt-0.5 truncate max-w-xs" style={{ color: 'var(--text-muted)' }}>{record.content}</div>}
        </div>
      ),
    },
    {
      title: '频次',
      dataIndex: 'frequency',
      key: 'frequency',
      width: 100,
      render: (f: string) => {
        const map: Record<string, { label: string; color: string }> = {
          once: { label: '仅一次', color: 'default' },
          daily: { label: '每天', color: 'blue' },
          weekly: { label: '每周', color: 'purple' },
        };
        const info = map[f] || { label: f, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '发送时间',
      key: 'time',
      width: 140,
      render: (_: any, record: ReminderItem) => {
        const day = record.send_day ? WEEKDAY_OPTIONS.find((d) => d.value === record.send_day)?.label : '';
        return <span>{day} {record.send_time?.slice(0, 5)}</span>;
      },
    },
    {
      title: '提醒对象',
      key: 'targets',
      render: (_: any, record: ReminderItem) => {
        const targets = record.reminder_targets || [];
        if (targets.length === 0) return <span style={{ color: 'var(--text-muted)' }}>未设置</span>;
        const names = targets.map((t) => t.users?.name || t.user_id.slice(0, 8)).join(', ');
        return (
          <Tooltip title={names}>
            <span>{targets.length} 人</span>
            {targets.some((t) => !t.users?.feishu_open_id) && (
              <Tag color="orange" className="ml-1">部分无飞书</Tag>
            )}
          </Tooltip>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (active: boolean) => <Tag color={active ? 'green' : 'default'}>{active ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: ReminderItem) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (authLoading) return <div className="flex justify-center items-center min-h-[60vh]">加载中...</div>;
  if (!isAdmin) return null;

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: 'var(--gradient-primary)', color: '#fff', boxShadow: '0 4px 15px rgba(26,58,138,0.25)' }}>
              <BellOutlined />
            </span>
            <div>
              <h1 className="text-xl font-bold">提醒管理</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>创建飞书提醒，选择对象自动发送</p>
            </div>
          </div>
          <Space>
            <Button icon={<ExperimentOutlined />} onClick={() => handleSend(true)} loading={sending}>
              预览（不发送）
            </Button>
            <Button type="primary" danger icon={<SendOutlined />} onClick={() => handleSend(false)} loading={sending}>
              立即发送
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              创建提醒
            </Button>
          </Space>
        </div>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={reminders}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />

        {/* Create/Edit Modal */}
        <Modal
          title={editing ? '编辑提醒' : '创建提醒'}
          open={modalOpen}
          onOk={handleSubmit}
          onCancel={() => setModalOpen(false)}
          okText="保存"
          cancelText="取消"
          width={600}
        >
          <Form form={form} layout="vertical" initialValues={{ frequency: 'once', is_active: true }}>
            <Form.Item name="title" label="提醒标题" rules={[{ required: true, message: '请输入标题' }]}>
              <Input placeholder="例：评审进度提醒" />
            </Form.Item>
            <Form.Item name="content" label="提醒内容">
              <Input.TextArea rows={3} placeholder="将作为飞书消息正文发送" />
            </Form.Item>
            <div className="flex gap-4">
              <Form.Item name="frequency" label="频次" rules={[{ required: true }]} className="flex-1">
                <Select options={FREQUENCY_OPTIONS} />
              </Form.Item>
              <Form.Item name="send_time" label="发送时间" rules={[{ required: true }]}>
                <TimePicker format="HH:mm" minuteStep={15} />
              </Form.Item>
              {frequency === 'weekly' && (
                <Form.Item name="send_day" label="周几" rules={[{ required: true }]}>
                  <Select options={WEEKDAY_OPTIONS} className="w-24" />
                </Form.Item>
              )}
            </div>
            <Form.Item name="user_ids" label="提醒对象">
              <Select
                mode="multiple"
                placeholder="选择用户（可多选）"
                optionFilterProp="label"
                options={users.map((u) => ({
                  value: u.id,
                  label: `${u.name}${u.has_feishu ? '' : ' (无飞书)'}`,
                  disabled: false,
                }))}
                optionRender={(option) => (
                  <div className="flex items-center justify-between">
                    <span>{option.label}</span>
                    {(() => {
                      const u = users.find((u) => u.id === option.value);
                      return u?.has_feishu
                        ? <Tag color="green" className="ml-2">飞书</Tag>
                        : <Tag color="orange" className="ml-2">无飞书</Tag>;
                    })()}
                  </div>
                )}
              />
            </Form.Item>
            <Form.Item name="is_active" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
}
