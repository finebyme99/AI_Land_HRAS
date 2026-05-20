'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Form, Input, Select, Switch, message, Spin } from 'antd';
import { ArrowLeftOutlined, BookOutlined, PlusOutlined } from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import type { CaseCategory, DifficultyLevel, Event } from '@/types';
import { CASE_CATEGORIES, DIFFICULTY_OPTIONS } from '@/lib/constants';

export default function CreateCasePage() {
  const [form] = Form.useForm();
  const [autoJoinEvent, setAutoJoinEvent] = useState(true);
  const [ongoingEvents, setOngoingEvents] = useState<Event[]>([]);

  useEffect(() => {
    async function fetchEvents() {
      const { data } = await getSupabase()
        .from('events')
        .select('*')
        .eq('status', 'ongoing')
        .limit(1);
      setOngoingEvents((data ?? []) as Event[]);
    }
    fetchEvents();
  }, []);

  const handleSubmit = (values: Record<string, unknown>) => {
    console.log({ ...values, autoJoinEvent });
    message.success('投稿成功！等待管理员审核');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link href="/cases" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeftOutlined /> 返回案例列表
      </Link>

      <h1 className="text-2xl font-semibold flex items-center gap-3 mb-6" style={{ fontFamily: 'var(--font-serif)' }}>
        <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(184, 92, 56, 0.08)', color: 'var(--primary)' }}>
          <PlusOutlined />
        </span>
        发布案例
      </h1>

      <div className="rounded-2xl p-6 sm:p-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入案例标题" maxLength={100} showCount />
          </Form.Item>

          <Form.Item name="summary" label="摘要" rules={[{ required: true, message: '请输入摘要' }]}>
            <Input.TextArea rows={3} placeholder="简要描述你的案例" maxLength={300} showCount />
          </Form.Item>

          <Form.Item name="category" label="HR 模块" rules={[{ required: true, message: '请选择分类' }]}>
            <Select placeholder="选择分类" options={CASE_CATEGORIES.map((c) => ({ label: c, value: c }))} />
          </Form.Item>

          <Form.Item name="difficulty" label="难度" rules={[{ required: true, message: '请选择难度' }]}>
            <Select placeholder="选择难度" options={DIFFICULTY_OPTIONS} />
          </Form.Item>

          <Form.Item name="ai_tools" label="使用的 AI 工具">
            <Select mode="tags" placeholder="输入工具名称后回车" />
          </Form.Item>

          <Form.Item name="content" label="正文" rules={[{ required: true, message: '请输入正文' }]}>
            <Input.TextArea rows={12} placeholder="支持 Markdown 格式" />
          </Form.Item>

          {ongoingEvents.length > 0 && (
            <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--background)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">关联 AI 大赛</span>
                <Switch checked={autoJoinEvent} onChange={setAutoJoinEvent} />
              </div>
              {autoJoinEvent && (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  案例将自动提交到 {ongoingEvents[0].title} 作品池
                </p>
              )}
            </div>
          )}

          <Form.Item>
            <div className="flex gap-3">
              <button className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
                style={{ background: 'var(--primary)' }}
                type="submit">
                提交审核
              </button>
              <button className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
                style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)', background: 'var(--surface)' }}
                type="button"
                onClick={() => message.info('已保存为草稿')}>
                保存草稿
              </button>
            </div>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
