'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Form, Input, Select, App, Tabs } from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  AppstoreOutlined,
  ReadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import { RESOURCE_CATEGORIES } from '@/types';
import { RESOURCE_TYPE_TABS } from '@/lib/constants';
import type { ResourceType, ResourceCategory } from '@/types';

const TYPE_ICONS: Record<ResourceType, React.ReactNode> = {
  ai_tool: <AppstoreOutlined />,
  guide: <ReadOutlined />,
  skill: <ThunderboltOutlined />,
};

export default function CreateResourcePage() {
  const { user } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [resourceType, setResourceType] = useState<ResourceType>('ai_tool');

  const categories = RESOURCE_CATEGORIES[resourceType];

  const handleTypeChange = (key: string) => {
    setResourceType(key as ResourceType);
    form.setFieldValue('category', undefined);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!user) {
      message.error('请先登录');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_type: resourceType,
          name: values.name,
          description: values.description,
          content: values.content || '',
          category: values.category,
          scenarios: values.scenarios || [],
          official_url: values.official_url || '',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '提交失败');
      }
      message.success('资源已提交，等待审核');
      window.location.href = '/apps';
    } catch (err) {
      console.error('Failed to create resource:', err);
      message.error(err instanceof Error ? err.message : '提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="glass rounded-2xl p-8 text-center" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <AppstoreOutlined className="text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>请先登录后再提交资源</p>
          <Link href="/login" className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
            去登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link href="/apps" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: 'var(--primary)' }}>
        <ArrowLeftOutlined /> 返回资源列表
      </Link>

      <h1 className="text-2xl font-semibold flex items-center gap-3 mb-6">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(26, 58, 138, 0.1)', color: 'var(--primary)' }}>
          <PlusOutlined />
        </span>
        提交资源
      </h1>

      {/* Resource Type Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>资源类型</label>
        <Tabs
          activeKey={resourceType}
          onChange={handleTypeChange}
          items={RESOURCE_TYPE_TABS.map((tab) => ({
            key: tab.key,
            label: (
              <span className="flex items-center gap-1.5">
                {TYPE_ICONS[tab.key]}
                {tab.label}
              </span>
            ),
          }))}
        />
      </div>

      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder={
              resourceType === 'ai_tool' ? '如：ChatGPT、Claude、Dify' :
              resourceType === 'guide' ? '如：HR 场景 Prompt 编写指南' :
              '如：简历筛选 Skill、会议纪要 Skill'
            } maxLength={80} showCount />
          </Form.Item>

          <Form.Item name="description" label="简介" rules={[{ required: true, message: '请输入简介' }]}>
            <Input.TextArea rows={3} placeholder="简要描述这个资源的用途和亮点" maxLength={500} showCount />
          </Form.Item>

          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select placeholder="选择分类" options={categories.map(c => ({ label: c, value: c }))} />
          </Form.Item>

          <Form.Item name="scenarios" label="适用场景">
            <Select mode="tags" placeholder="输入场景标签后回车" maxCount={5} />
          </Form.Item>

          <Form.Item name="official_url" label={resourceType === 'guide' ? '参考链接' : '官网 / 项目地址'}>
            <Input placeholder="https://..." />
          </Form.Item>

          {/* 操作指引和 Skills 需要正文内容 */}
          {(resourceType === 'guide' || resourceType === 'skill') && (
            <Form.Item name="content" label={resourceType === 'guide' ? '操作指引正文' : 'Skill 说明'} rules={[{ required: true, message: '请输入内容' }]}>
              <Input.TextArea rows={10} placeholder={
                resourceType === 'guide'
                  ? '详细的操作步骤、使用技巧、注意事项等'
                  : 'Skill 的功能描述、使用方法、触发条件、示例等'
              } />
            </Form.Item>
          )}

          <Form.Item>
            <button
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              style={{ background: 'var(--primary)' }}
              type="submit"
              disabled={submitting}>
              <PlusOutlined /> {submitting ? '提交中...' : '提交资源'}
            </button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
