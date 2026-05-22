'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Form, Input, Select, App } from 'antd';
import { ArrowLeftOutlined, CommentOutlined } from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';

export default function CreateTopicPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      const { error } = await getSupabase().from('topics').insert({
        title: values.title as string,
        content: values.content as string,
        tags: (values.tags as string[]) || [],
      });
      if (error) throw error;
      message.success('话题发布成功！');
      window.location.href = '/topics';
    } catch {
      message.error('发布失败，请重试');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link href="/topics" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: 'var(--primary)' }}>
        <ArrowLeftOutlined /> 返回话题列表
      </Link>

      <h1 className="text-2xl font-semibold flex items-center gap-3 mb-6">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(45, 90, 61, 0.08)', color: 'var(--accent)' }}>
          <CommentOutlined />
        </span>
        发起话题或提问
      </h1>

      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="用一句话描述你的问题或话题" maxLength={100} showCount />
          </Form.Item>

          <Form.Item name="content" label="详细描述" rules={[{ required: true, message: '请输入描述' }]}>
            <Input.TextArea rows={6} placeholder="详细描述你的问题，或发起一个讨论话题" maxLength={2000} showCount />
          </Form.Item>

          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="添加标签，如：招聘、Prompt、飞书" maxCount={5} />
          </Form.Item>

          <Form.Item>
            <button className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ background: 'var(--primary)' }}
              type="submit">
              发布话题
            </button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
