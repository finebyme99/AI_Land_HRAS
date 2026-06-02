'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Space,
  Popconfirm,
  Tabs,
  Card,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  BellOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SendOutlined,
  HistoryOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';

interface ReminderRule {
  id: string;
  name: string;
  type: string;
  trigger_event: string | null;
  priority: string;
  template_id: string | null;
  is_active: boolean;
  created_at: string;
  reminder_recipients?: any[];
}

interface ReminderLog {
  id: string;
  rule_id: string | null;
  recipient_id: string;
  recipient_type: string;
  message_id: string | null;
  status: string;
  priority: string | null;
  error_message: string | null;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

export default function AdminRemindersPage() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();
  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<ReminderRule | null>(null);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('rules');

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace('/');
    }
  }, [authLoading, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) {
      fetchRules();
      fetchLogs();
    }
  }, [isAdmin]);

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/admin/reminders/rules');
      if (!res.ok) throw new Error('获取失败');
      const data = await res.json();
      setRules(data.rules || []);
    } catch {
      message.error('获取提醒规则失败');
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/reminders/logs?limit=50');
      if (!res.ok) throw new Error('获取失败');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      message.error('获取提醒日志失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingRule(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (rule: ReminderRule) => {
    setEditingRule(rule);
    form.setFieldsValue({
      name: rule.name,
      type: rule.type,
      trigger_event: rule.trigger_event,
      priority: rule.priority,
      is_active: rule.is_active,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/reminders/rules/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('删除失败');
      message.success('删除成功');
      fetchRules();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const url = editingRule
        ? `/api/admin/reminders/rules/${editingRule.id}`
        : '/api/admin/reminders/rules';
      const method = editingRule ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!res.ok) throw new Error('操作失败');
      message.success(editingRule ? '更新成功' : '创建成功');
      setModalVisible(false);
      fetchRules();
    } catch {
      message.error('操作失败');
    }
  };

  const handleSendTest = async (ruleId: string) => {
    try {
      const res = await fetch('/api/admin/reminders/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule_id: ruleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '发送失败');
      message.success(`发送成功: ${data.sent} 条，失败: ${data.failed} 条`);
      fetchLogs();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '发送失败');
    }
  };

  const ruleColumns = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeMap: Record<string, { label: string; color: string }> = {
          review_progress: { label: '评审进度', color: 'blue' },
          deadline: { label: '截止日期', color: 'orange' },
          new_content: { label: '新内容', color: 'green' },
          custom: { label: '自定义', color: 'purple' },
        };
        const info = typeMap[type] || { label: type, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => {
        const colorMap: Record<string, string> = {
          high: 'red',
          medium: 'orange',
          low: 'green',
        };
        return <Tag color={colorMap[priority] || 'default'}>{priority}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => new Date(val).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: ReminderRule) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<SendOutlined />}
            onClick={() => handleSendTest(record.id)}
          >
            测试发送
          </Button>
          <Popconfirm
            title="确认删除此规则？"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const logColumns = [
    {
      title: '接收人',
      dataIndex: 'recipient_id',
      key: 'recipient_id',
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'recipient_type',
      key: 'recipient_type',
      render: (type: string) => <Tag>{type}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          sent: 'green',
          failed: 'red',
          read: 'blue',
          pending: 'orange',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => <Tag>{priority}</Tag>,
    },
    {
      title: '发送时间',
      dataIndex: 'sent_at',
      key: 'sent_at',
      render: (val: string) => val ? new Date(val).toLocaleString('zh-CN') : '-',
    },
    {
      title: '错误信息',
      dataIndex: 'error_message',
      key: 'error_message',
      ellipsis: true,
      render: (val: string) => val || '-',
    },
  ];

  if (authLoading) {
    return <div className="flex justify-center items-center min-h-[60vh]">加载中...</div>;
  }

  if (!isAdmin) return null;

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{
                background: 'var(--gradient-primary)',
                color: '#fff',
                boxShadow: '0 4px 15px rgba(26,58,138,0.25)',
              }}
            >
              <BellOutlined />
            </span>
            <div>
              <h1 className="text-xl font-bold">提醒管理</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                管理飞书提醒规则和查看发送记录
              </p>
            </div>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            创建规则
          </Button>
        </div>

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="提醒规则" key="rules">
            <Table
              columns={ruleColumns}
              dataSource={rules}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </Tabs.TabPane>
          <Tabs.TabPane tab="发送记录" key="logs">
            <Table
              columns={logColumns}
              dataSource={logs}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 20 }}
            />
          </Tabs.TabPane>
        </Tabs>

        <Modal
          title={editingRule ? '编辑规则' : '创建规则'}
          open={modalVisible}
          onOk={handleSubmit}
          onCancel={() => setModalVisible(false)}
          okText="保存"
          cancelText="取消"
        >
          <Form form={form} layout="vertical">
            <Form.Item
              name="name"
              label="规则名称"
              rules={[{ required: true, message: '请输入规则名称' }]}
            >
              <Input placeholder="请输入规则名称" />
            </Form.Item>
            <Form.Item
              name="type"
              label="规则类型"
              rules={[{ required: true, message: '请选择规则类型' }]}
            >
              <Select placeholder="请选择规则类型">
                <Select.Option value="review_progress">评审进度提醒</Select.Option>
                <Select.Option value="deadline">截止日期提醒</Select.Option>
                <Select.Option value="new_content">新内容提醒</Select.Option>
                <Select.Option value="custom">自定义提醒</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="trigger_event" label="触发事件">
              <Select placeholder="请选择触发事件" allowClear>
                <Select.Option value="review_completed">评审完成</Select.Option>
                <Select.Option value="deadline_approaching">截止日期临近</Select.Option>
                <Select.Option value="new_submission">新方案提交</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="priority"
              label="优先级"
              rules={[{ required: true, message: '请选择优先级' }]}
            >
              <Select placeholder="请选择优先级">
                <Select.Option value="high">高</Select.Option>
                <Select.Option value="medium">中</Select.Option>
                <Select.Option value="low">低</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="is_active"
              label="启用状态"
              valuePropName="checked"
              initialValue={true}
            >
              <Switch />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
}
