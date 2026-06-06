'use client';
import { useState, useEffect } from 'react';
import { App, Button, Card, Checkbox, Form, Input, Modal, Space, Table } from 'antd';
import { PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { FeishuApp } from '@/types';

export default function FeishuAppsPage() {
  const { message: msgApi } = App.useApp();
  const [apps, setApps] = useState<FeishuApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/feishu-apps');
      const j = await r.json();
      if (r.ok) setApps(j.apps);
      else msgApi.error(j.error);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const onCreate = async () => {
    const values = await form.validateFields();
    const r = await fetch('/api/feishu-apps', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const j = await r.json();
    if (r.ok) { msgApi.success('已录入'); setModalOpen(false); form.resetFields(); load(); }
    else msgApi.error(j.error);
  };

  const onToggleStatus = async (a: FeishuApp) => {
    const next = a.status === 'active' ? 'disabled' : 'active';
    const r = await fetch('/api/feishu-apps', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: a.id, status: next }),
    });
    if (r.ok) { msgApi.success('已更新'); load(); }
  };

  const onTest = async (a: FeishuApp) => {
    const r = await fetch('/api/feishu-apps', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: a.id }),
    });
    const j = await r.json();
    if (j.ok) msgApi.success('连通成功');
    else msgApi.error(`连通失败：${j.error}`);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">飞书应用配置</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新增企业</Button>
      </div>
      <Card className="glass" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
        <Table
          dataSource={apps}
          rowKey="id"
          loading={loading}
          columns={[
            { title: '企业名称', dataIndex: 'enterprise_name' },
            { title: 'App ID', dataIndex: 'app_id' },
            { title: 'Tenant Key', dataIndex: 'tenant_key' },
            { title: '状态', dataIndex: 'status', render: (s) => s === 'active' ? '✅ active' : '⛔ disabled' },
            { title: '创建时间', dataIndex: 'created_at', render: (t) => new Date(t).toLocaleString() },
            {
              title: '操作', render: (_, a) => (
                <Space>
                  <Button size="small" icon={<ThunderboltOutlined />} onClick={() => onTest(a)}>测试</Button>
                  <Button size="small" onClick={() => onToggleStatus(a)}>{a.status === 'active' ? '禁用' : '启用'}</Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="新增飞书企业"
        open={modalOpen}
        onOk={onCreate}
        onCancel={() => setModalOpen(false)}
        okText="录入"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="企业代码"
            name="enterprise_name"
            rules={[{ required: true, message: '请输入企业代码' }]}
            extra="建议使用 2-3 个字母的短码（如 ZT、GF、WX），将显示在登录按钮上"
          >
            <Input placeholder="如：ZT" />
          </Form.Item>
          <Form.Item label="App ID" name="app_id" rules={[{ required: true }]}>
            <Input placeholder="飞书开放平台 app_id" />
          </Form.Item>
          <Form.Item label="App Secret" name="app_secret" rules={[{ required: true }]}>
            <Input.Password placeholder="敏感信息，仅 admin 可见" />
          </Form.Item>
          <Form.Item label="Tenant Key" name="tenant_key" rules={[{ required: true }]}>
            <Input placeholder="飞书租户 key（企业管理员在飞书后台可查）" />
          </Form.Item>
          <Form.Item label="回调 URL" name="redirect_uri" rules={[{ required: true }]}>
            <Input placeholder="https://hras-ai-land.vercel.app/api/auth/feishu/callback" />
          </Form.Item>
          <Form.Item
            name="redirect_uri_confirmed"
            valuePropName="checked"
            rules={[{
              validator: (_, v) => v ? Promise.resolve() : Promise.reject(new Error('请确认已配置回调 URL')),
            }]}
            extra={
              <span style={{ color: '#b3540e' }}>
                ⚠️ 必勾：你（或对方 IT）已登录飞书开放平台后台，把上面的「回调 URL」加进该应用的「重定向 URL」白名单？<br />
                没配的话，登录会报飞书 error 20029「重定向 URL 有误」。
              </span>
            }
          >
            <Checkbox>已确认在飞书开放平台配好「重定向 URL」白名单</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
