'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, InputNumber, Button, Spin, message } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';

export default function AdminSettingsPage() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/');
  }, [authLoading, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) {
      fetch('/api/admin/settings')
        .then((r) => r.json())
        .then((data) => {
          form.setFieldsValue({
            saved_hours: data.saved_hours || 0,
            participant_count: data.participant_count || 0,
          });
        })
        .catch(() => message.error('加载设置失败'))
        .finally(() => setLoading(false));
    }
  }, [isAdmin, form]);

  const handleSave = async (values: { saved_hours: number; participant_count: number }) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error('保存失败');
      message.success('设置已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-xl font-bold mb-6">平台设置</h1>

      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-1">首页数据大屏</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            设置首页右侧数据面板展示的数值，保存后立即生效
          </p>
        </div>

        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            name="saved_hours"
            label="累计节省工时（小时）"
            rules={[{ required: true, message: '请输入工时数' }]}
          >
            <InputNumber
              min={0}
              max={999999}
              style={{ width: '100%' }}
              placeholder="输入累计节省的工时数"
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>

          <Form.Item
            name="participant_count"
            label="参与人数"
            rules={[{ required: true, message: '请输入参与人数' }]}
          >
            <InputNumber
              min={0}
              max={999999}
              style={{ width: '100%' }}
              placeholder="输入平台参与人数"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={saving}
              size="large"
            >
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
