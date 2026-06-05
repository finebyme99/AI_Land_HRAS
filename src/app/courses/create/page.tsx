'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Form, Input, Select, App, DatePicker } from 'antd';
import { ArrowLeftOutlined, ReadOutlined, PlusOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import dayjs from 'dayjs';

export default function CreateCoursePage() {
  const { canManageCourses } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  if (!canManageCourses) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="glass rounded-2xl p-8 text-center" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <ReadOutlined className="text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-base mb-4" style={{ color: 'var(--text-secondary)' }}>
            课程由管理员统一发布
          </p>
          <Link href="/courses" className="text-sm transition-opacity hover:opacity-70" style={{ color: 'var(--primary)' }}>
            返回课程列表
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title,
          description: values.description,
          instructor: values.instructor,
          content_type: values.content_type || [],
          cover_image: values.cover_image || '',
          courseware_url: values.courseware_url || '',
          video_url: values.video_url || '',
          created_at: values.published_at ? (values.published_at as dayjs.Dayjs).startOf('day').toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '发布失败');
      }
      message.success('课程发布成功！');
      window.location.href = '/courses';
    } catch (err) {
      console.error('Failed to create course:', err);
      message.error(err instanceof Error ? err.message : '发布失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link href="/courses" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: 'var(--primary)' }}>
        <ArrowLeftOutlined /> 返回课程列表
      </Link>

      <h1 className="text-2xl font-semibold flex items-center gap-3 mb-6">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(74, 111, 165, 0.08)', color: '#4a6fa5' }}>
          <ReadOutlined />
        </span>
        发布新课程
      </h1>

      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="title" label="课程标题" rules={[{ required: true, message: '请输入课程标题' }]}>
            <Input placeholder="输入课程标题" maxLength={100} showCount />
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Form.Item name="instructor" label="讲师" rules={[{ required: true, message: '请输入讲师名称' }]}>
              <Input placeholder="讲师名称" />
            </Form.Item>
            <Form.Item name="published_at" label="发布日期" initialValue={dayjs()}>
              <DatePicker className="w-full" placeholder="选择发布日期" />
            </Form.Item>
          </div>

          <Form.Item name="content_type" label="内容形式" rules={[{ required: true, message: '请选择内容形式' }]}>
            <Select
              mode="multiple"
              placeholder="选择形式（可多选）"
              options={[
                { label: '视频', value: 'video' },
                { label: '文档', value: 'doc' },
              ]}
              maxTagCount={3}
            />
          </Form.Item>

          <Form.Item name="cover_image" label="封面图 URL">
            <Input placeholder="输入封面图片地址（可选）" />
          </Form.Item>

          {/* Links */}
          <div className="mb-6">
            <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
              课件与视频链接
            </div>
            <div className="space-y-3">
              <Form.Item name="courseware_url" label="课件链接" className="!mb-3">
                <Input placeholder="输入课件文档链接（如飞书文档、Google Docs 等）" />
              </Form.Item>
              <Form.Item name="video_url" label="视频链接">
                <Input placeholder="输入视频链接（如 B站、YouTube 等）" />
              </Form.Item>
            </div>
          </div>

          <Form.Item>
            <button
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ background: 'var(--primary)' }}
              type="submit"
              disabled={submitting}
            >
              {submitting ? '发布中...' : '发布课程'}
            </button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
