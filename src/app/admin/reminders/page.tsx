'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table, Tag, Button, Modal, Form, Input, Select, Switch, App,
  Space, Popconfirm, TimePicker, DatePicker, Tooltip, Radio,
} from 'antd';
import {
  BellOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  SendOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import { FEISHU_CARD_TEMPLATES, getFeishuCardTemplateById } from '@/lib/feishu-card-templates';
import dayjs from 'dayjs';

type RecipientType = 'user' | 'role' | 'chat_id';

interface UserOption {
  id: string;
  name: string;
  has_feishu: boolean;
  roles: string[];
}

interface ChatOption {
  chat_id: string;
  name: string;
  description?: string;
}

interface ReminderTargetRow {
  id: string;
  user_id: string | null;
  recipient_type: RecipientType;
  recipient_id: string | null;
  users?: { name: string; feishu_open_id: string | null };
}

interface ReminderItem {
  id: string;
  title: string;
  content: string;
  frequency: string;
  send_time: string;
  send_day: number | null;
  send_date: string | null;
  next_send_at: string | null;
  is_active: boolean;
  card_template: Record<string, unknown> | null;
  created_at: string;
  reminder_targets?: ReminderTargetRow[];
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
  const [chats, setChats] = useState<ChatOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ReminderItem | null>(null);
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [form] = Form.useForm();

  const frequency = Form.useWatch('frequency', form);
  const recipientType = Form.useWatch('recipient_type', form) as RecipientType | undefined;
  const useCard = Form.useWatch('use_card', form) as boolean | undefined;
  const cardTemplateId = Form.useWatch('card_template_id', form) as string | undefined;

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

  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/feishu/chats');
      if (!res.ok) return; // 群聊 API 失败不阻塞（可能飞书权限不够）
      const data = await res.json();
      setChats(data.chats || []);
    } catch {
      /* ignore — 群聊拉取失败时回退成手填 chat_id */
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchReminders();
      fetchUsers();
      fetchChats();
    }
  }, [isAdmin, fetchReminders, fetchUsers, fetchChats]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      frequency: 'once',
      send_time: dayjs('09:00', 'HH:mm'),
      recipient_type: 'user',
      use_card: false,
    });
    setModalOpen(true);
  };

  const openEdit = (item: ReminderItem) => {
    setEditing(item);
    // 推断 recipient_type：看 targets 决定是 user / role / chat_id
    const targets = item.reminder_targets ?? [];
    const firstType: RecipientType = (targets[0]?.recipient_type as RecipientType) ?? 'user';
    const allSameType = targets.every((t) => (t.recipient_type ?? 'user') === firstType);

    // 检测现有 card_template 匹配哪个预设 id
    let matchedTemplateId: string | undefined;
    if (item.card_template) {
      const matchTpl = FEISHU_CARD_TEMPLATES.find((t) => JSON.stringify(t.json) === JSON.stringify(item.card_template));
      matchedTemplateId = matchTpl?.id ?? '__custom__';
    }

    form.setFieldsValue({
      title: item.title,
      content: item.content,
      frequency: item.frequency,
      send_time: dayjs(item.send_time, 'HH:mm'),
      send_day: item.send_day,
      send_date: item.send_date ? dayjs(item.send_date) : null,
      is_active: item.is_active,
      recipient_type: allSameType ? firstType : 'user',
      user_ids: targets.filter((t) => (t.recipient_type ?? 'user') === 'user').map((t) => t.user_id).filter(Boolean) as string[],
      role_ids: targets.filter((t) => t.recipient_type === 'role').map((t) => t.recipient_id).filter(Boolean) as string[],
      chat_id: targets.find((t) => t.recipient_type === 'chat_id')?.recipient_id ?? undefined,
      use_card: !!item.card_template,
      card_template_id: matchedTemplateId,
      card_template: item.card_template ? JSON.stringify(item.card_template, null, 2) : '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const rType: RecipientType = values.recipient_type ?? 'user';

      // 把 3 种类型统一成 targets 数组
      const targets: Array<{ recipient_type: RecipientType; recipient_id: string | null; user_id: string | null }> = [];
      if (rType === 'user') {
        for (const id of (values.user_ids ?? [])) targets.push({ recipient_type: 'user', recipient_id: id, user_id: id });
      } else if (rType === 'role') {
        for (const r of (values.role_ids ?? [])) targets.push({ recipient_type: 'role', recipient_id: r, user_id: null });
      } else if (rType === 'chat_id') {
        if (values.chat_id) targets.push({ recipient_type: 'chat_id', recipient_id: values.chat_id, user_id: null });
      }

      // 卡片模板（可选）
      let cardTemplate: Record<string, unknown> | null = null;
      if (values.use_card && values.card_template) {
        try {
          cardTemplate = JSON.parse(values.card_template);
        } catch {
          message.error('卡片 JSON 格式错误');
          return;
        }
      }

      const body = {
        title: values.title,
        content: values.content || '',
        frequency: values.frequency,
        send_time: values.send_time.format('HH:mm'),
        send_day: values.frequency === 'weekly' ? values.send_day : null,
        send_date: values.frequency === 'once' ? values.send_date?.format('YYYY-MM-DD') : null,
        is_active: values.is_active ?? true,
        targets,
        card_template: cardTemplate,
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

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const res = await fetch('/api/admin/reminders/send?mode=preview', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '预览失败');
      if (data.status === 'failed') {
        Modal.error({
          title: '飞书发送失败',
          content: `错误信息: ${data.error || '未知错误'}\n\n请检查飞书应用权限（需要 im:message 权限）`,
        });
      } else {
        message.success(`预览已发送到你的飞书（${data.sent_to}），请查看飞书消息`);
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '预览失败');
    } finally {
      setPreviewing(false);
    }
  };

  const handleSend = async (specificId?: string) => {
    setSending(true);
    try {
      const url = specificId
        ? `/api/admin/reminders/send?mode=send&id=${encodeURIComponent(specificId)}`
        : '/api/admin/reminders/send?mode=send';
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '发送失败');

      const parts = [];
      if (data.mode === 'send-one') {
        parts.push(`📤「${data.title}」已立即发送`);
        parts.push(`✅ ${data.sent} 成功`);
        if (data.failed > 0) parts.push(`❌ ${data.failed} 失败`);
        if (data.noFeishuId > 0) parts.push(`⚠️ ${data.noFeishuId} 无飞书ID`);
        if (data.skipped > 0) parts.push(`⏭ ${data.skipped} 跳过`);
      } else {
        parts.push(`✅ ${data.sent} 成功`);
        if (data.failed > 0) parts.push(`❌ ${data.failed} 失败`);
        if (data.noFeishuId > 0) parts.push(`⚠️ ${data.noFeishuId} 无飞书ID`);
        if (data.skipped > 0) parts.push(`⏭ ${data.skipped} 跳过`);
      }

      // 显示失败详情
      const failedDetails = data.details?.filter((d: any) => d.status === 'failed') || [];
      if (failedDetails.length > 0) {
        const errors = failedDetails.map((d: any) => `${d.title}: ${d.error || '未知错误'}`).join('\n');
        Modal.error({ title: '发送失败详情', content: <pre className="text-xs whitespace-pre-wrap">{errors}</pre> });
      } else {
        message.success(parts.join('，'));
      }

      fetchReminders();
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
        if (record.frequency === 'once') {
          return <span>{record.send_date} {record.send_time?.slice(0, 5)}</span>;
        }
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
        const names = targets.map((t) => t.users?.name || t.recipient_id || t.user_id?.slice(0, 8) || '—').join(', ');
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
      width: 240,
      render: (_: any, record: ReminderItem) => (
        <Space size="small">
          <Button type="link" size="small" icon={<SendOutlined />} onClick={() => handleSend(record.id)} loading={sending}>
            立即发送
          </Button>
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
            <Button icon={<ExperimentOutlined />} onClick={handlePreview} loading={previewing}>
              预览（发给自己）
            </Button>
            <Button icon={<SendOutlined />} onClick={() => handleSend()} loading={sending}>
              扫发到期
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
            <Form.Item
              name="content"
              label="提醒内容"
              extra={
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  支持超链接语法 <code>[显示文本](https://url)</code> — 含链接时自动用富文本（post）发送，否则用纯文本
                </span>
              }
            >
              <Input.TextArea rows={4} placeholder="例：本周评审截止 [评审入口](https://example.com)\n\n也可纯文本多行" />
            </Form.Item>
            <div className="flex gap-4">
              <Form.Item name="frequency" label="频次" rules={[{ required: true }]} className="flex-1">
                <Select options={FREQUENCY_OPTIONS} />
              </Form.Item>
              <Form.Item name="send_time" label="发送时间" rules={[{ required: true }]}>
                <TimePicker format="HH:mm" minuteStep={15} />
              </Form.Item>
              {frequency === 'once' && (
                <Form.Item name="send_date" label="发送日期" rules={[{ required: true, message: '请选择发送日期' }]}>
                  <DatePicker className="w-full" />
                </Form.Item>
              )}
              {frequency === 'weekly' && (
                <Form.Item name="send_day" label="周几" rules={[{ required: true }]}>
                  <Select options={WEEKDAY_OPTIONS} className="w-24" />
                </Form.Item>
              )}
            </div>
            <Form.Item name="recipient_type" label="收件人类型" rules={[{ required: true }]}>
              <Radio.Group>
                <Radio.Button value="user">按人</Radio.Button>
                <Radio.Button value="role">按角色</Radio.Button>
                <Radio.Button value="chat_id">按群聊</Radio.Button>
              </Radio.Group>
            </Form.Item>
            {recipientType === 'user' && (
              <Form.Item name="user_ids" label="提醒对象" rules={[{ required: true, message: '请选择至少一个用户' }]}>
                <Select
                  mode="multiple"
                  placeholder="选择用户（可多选）"
                  optionFilterProp="label"
                  options={users.map((u) => ({
                    value: u.id,
                    label: `${u.name}${u.has_feishu ? '' : ' (无飞书)'}`,
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
            )}
            {recipientType === 'role' && (
              <Form.Item name="role_ids" label="角色" rules={[{ required: true, message: '请选择至少一个角色' }]}>
                <Select
                  mode="multiple"
                  placeholder="选择角色（多选）"
                  options={[
                    { value: 'admin', label: '管理员' },
                    { value: 'moderator', label: '版主' },
                    { value: 'reviewer', label: '评委' },
                    { value: 'course_admin', label: 'AI 课程管理员' },
                    { value: 'contributor', label: '贡献者' },
                  ]}
                />
              </Form.Item>
            )}
            {recipientType === 'chat_id' && (
              <Form.Item name="chat_id" label="飞书群聊" rules={[{ required: true, message: '请选择群聊' }]}>
                <Select
                  showSearch
                  placeholder={chats.length > 0 ? '选择群聊' : '拉取群聊失败，可手填 chat_id'}
                  options={chats.map((c) => ({ value: c.chat_id, label: c.name }))}
                  filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                />
              </Form.Item>
            )}
            <Form.Item name="use_card" label="发送卡片（替代文本）" valuePropName="checked">
              <Switch />
            </Form.Item>
            {useCard && (
              <>
                <Form.Item
                  name="card_template_id"
                  label="卡片模板"
                  tooltip="选预设（推荐），或选「自定义」自己贴 JSON"
                  rules={[{ required: true, message: '启用卡片后必选模板' }]}
                >
                  <Select
                    placeholder="选择卡片模板"
                    options={[
                      ...FEISHU_CARD_TEMPLATES.map((t) => ({ value: t.id, label: `${t.name} — ${t.description}` })),
                      { value: '__custom__', label: '自定义（下面贴 JSON）' },
                    ]}
                    onChange={(v) => {
                      if (v && v !== '__custom__') {
                        const tpl = getFeishuCardTemplateById(v);
                        if (tpl) form.setFieldValue('card_template', JSON.stringify(tpl.json, null, 2));
                      } else {
                        form.setFieldValue('card_template', '');
                      }
                    }}
                  />
                </Form.Item>
                <Form.Item
                  name="card_template"
                  label="飞书卡片 JSON（选预设自动填，可手动改）"
                  tooltip="完整飞书卡片 JSON；包含 header/elements 等结构"
                  rules={[{ required: true, message: '启用卡片后必填' }]}
                >
                  <Input.TextArea rows={8} placeholder='{"header": {...}, "elements": [...]}' style={{ fontFamily: 'monospace' }} />
                </Form.Item>
              </>
            )}
            <Form.Item name="is_active" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
}
