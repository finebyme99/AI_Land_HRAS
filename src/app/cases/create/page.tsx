'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Form, Input, Select, App } from 'antd';
import { ArrowLeftOutlined, BookOutlined, PlusOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import { CASE_CATEGORY_OPTIONS, AI_TOOL_OPTIONS, CASE_TEAM_OPTIONS, CASE_BUSINESS_SCENARIO_OPTIONS } from '@/lib/constants';

export default function CreateCasePage() {
  const { user, isAdmin } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="glass rounded-2xl p-8 text-center" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <BookOutlined className="text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>案例由管理员统一发布，暂不开放全员投稿</p>
          <Link href="/cases" className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
            返回案例列表
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!user) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title,
          summary: values.summary,
          content: values.content,
          category: values.category,
          ai_tools: values.ai_tools || [],
          team: values.team || '',
          business_scenario: values.business_scenario || '',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '发布失败');
      }
      message.success('案例发布成功！');
      window.location.href = '/cases';
    } catch (err) {
      console.error('Failed to create case:', err);
      message.error(err instanceof Error ? err.message : '发布失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link href="/cases" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: 'var(--primary)' }}>
        <ArrowLeftOutlined /> 返回案例列表
      </Link>

      <h1 className="text-2xl font-semibold flex items-center gap-3 mb-6">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(26, 58, 138, 0.1)', color: 'var(--primary)' }}>
          <BookOutlined />
        </span>
        提交案例
      </h1>

      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ difficulty: '基础' }}>
          <Form.Item name="title" label="案例标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="用一句话描述你的 AI 实践案例" maxLength={100} showCount />
          </Form.Item>

          <Form.Item name="summary" label="摘要" rules={[{ required: true, message: '请输入摘要' }]}>
            <Input.TextArea rows={2} placeholder="简要概括案例的核心价值和效果" maxLength={300} showCount />
          </Form.Item>

          <Form.Item name="content" label="详细内容" rules={[{ required: true, message: '请输入内容' }]}>
            <Input.TextArea rows={10} placeholder="详细描述你的 AI 实践过程，包括：&#10;1. 背景和痛点&#10;2. 使用了哪些 AI 工具&#10;3. 具体操作步骤&#10;4. 效果和收获" />
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Form.Item name="category" label="HR 模块" rules={[{ required: true, message: '请选择分类' }]}>
              <Select placeholder="选择 HR 模块分类" options={CASE_CATEGORY_OPTIONS} />
            </Form.Item>

            <Form.Item name="team" label="提报团队">
              <Select placeholder="选择提报团队" options={CASE_TEAM_OPTIONS} allowClear />
            </Form.Item>

            <Form.Item name="business_scenario" label="业务场景">
              <Select placeholder="选择业务场景" options={CASE_BUSINESS_SCENARIO_OPTIONS} allowClear />
            </Form.Item>
          </div>

          <Form.Item name="ai_tools" label="使用的 AI 工具">
            <Select mode="tags" placeholder="选择或输入 AI 工具" options={AI_TOOL_OPTIONS} maxCount={5} />
          </Form.Item>

          <Form.Item>
            <button
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              style={{ background: 'var(--primary)' }}
              type="submit"
              disabled={submitting}>
              <PlusOutlined /> {submitting ? '发布中...' : '发布案例'}
            </button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
