'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Form, Input, Select, InputNumber, App } from 'antd';
import { ArrowLeftOutlined, BookOutlined, PlusOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import {
  CASE_CATEGORY_OPTIONS,
  AI_TOOL_OPTIONS,
  CASE_TEAM_OPTIONS,
  CASE_BUSINESS_SCENARIO_OPTIONS,
  PAIN_POINT_OPTIONS,
  OTHER_VALUE_OPTIONS,
} from '@/lib/constants';

export default function CreateCasePage() {
  const { user } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [userList, setUserList] = useState<{ id: string; name: string; avatar: string; department: string }[]>([]);

  // 获取用户列表
  useEffect(() => {
    if (!user) return;
    fetch('/api/users/list')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.users) {
          setUserList(data.users);
          // 默认开发者 = 当前用户
          form.setFieldValue('developers', [user.id]);
        }
      })
      .catch(() => {});
  }, [user, form]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="glass rounded-2xl p-8 text-center" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <BookOutlined className="text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>请先登录后再提交案例</p>
          <Link href="/login" className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
            去登录
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
          team: values.team,
          business_scenario: values.business_scenario,
          team_members: values.team_members,
          original_business_scenario: values.original_business_scenario,
          pain_points: values.pain_points,
          monthly_saved_hours: values.monthly_saved_hours,
          efficiency_ratio: values.efficiency_ratio,
          ai_tools: values.ai_tools,
          demo_link: values.demo_link,
          other_values: values.other_values || [],
          developers: values.developers || [user.id],
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '提交失败');
      }
      const data = await res.json();
      if (data.case?.status === 'published') {
        message.success('案例已发布');
      } else {
        message.success('案例已提交，等待审核');
      }
      window.location.href = '/cases';
    } catch (err) {
      console.error('Failed to create case:', err);
      message.error(err instanceof Error ? err.message : '提交失败，请重试');
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
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0F2057, #1a3a8a)', color: '#fff' }}>
          <BookOutlined />
        </span>
        提交案例
      </h1>

      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {/* 开发者 */}
          <div className="mb-6">
            <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--foreground)' }}>开发者</h3>
            <Form.Item name="developers" label="开发者" rules={[{ required: true, message: '请选择开发者' }]}>
              <Select
                mode="multiple"
                placeholder="选择开发者（默认为自己）"
                options={userList.map(u => ({ label: `${u.name}（${u.department || '-'}）`, value: u.id }))}
                showSearch
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
                }
              />
            </Form.Item>
          </div>

          {/* 基本信息 */}
          <div className="mb-6">
            <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--foreground)' }}>基本信息</h3>
            <Form.Item name="title" label="案例标题" rules={[{ required: true, message: '请输入案例标题' }]}>
              <Input placeholder="用一句话描述你的 AI 实践案例" maxLength={100} showCount />
            </Form.Item>

            <Form.Item name="summary" label="摘要" rules={[{ required: true, message: '请输入摘要' }]}>
              <Input.TextArea rows={2} placeholder="简要概括案例的核心价值和效果" maxLength={300} showCount />
            </Form.Item>

            <Form.Item name="content" label="详细内容" rules={[{ required: true, message: '请输入详细内容' }]}>
              <Input.TextArea rows={8} placeholder="详细描述你的 AI 实践过程，包括：&#10;1. 背景和痛点&#10;2. 使用了哪些 AI 工具&#10;3. 具体操作步骤&#10;4. 效果和收获" />
            </Form.Item>
          </div>

          {/* 团队与场景 */}
          <div className="mb-6">
            <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--foreground)' }}>团队与场景</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Form.Item name="team" label="提报团队" rules={[{ required: true, message: '请选择提报团队' }]}>
                <Select placeholder="选择提报团队" options={CASE_TEAM_OPTIONS} />
              </Form.Item>

              <Form.Item name="business_scenario" label="业务场景" rules={[{ required: true, message: '请选择业务场景' }]}>
                <Select placeholder="选择业务场景" options={CASE_BUSINESS_SCENARIO_OPTIONS} />
              </Form.Item>
            </div>

            <Form.Item name="team_members" label="案例小组成员" rules={[{ required: true, message: '请输入案例小组成员' }]}>
              <Input placeholder="输入参与案例的小组成员姓名，用逗号分隔" />
            </Form.Item>

            <Form.Item name="category" label="提效/增值场景分类" rules={[{ required: true, message: '请选择场景分类' }]}>
              <Select placeholder="选择 HR 模块分类" options={CASE_CATEGORY_OPTIONS} />
            </Form.Item>

            <Form.Item name="original_business_scenario" label="原业务场景" rules={[{ required: true, message: '请输入原业务场景' }]}>
              <Input placeholder="描述 AI 应用前的业务场景" />
            </Form.Item>
          </div>

          {/* 痛点与提效 */}
          <div className="mb-6">
            <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--foreground)' }}>痛点与提效</h3>
            <Form.Item name="pain_points" label="原核心痛点" rules={[{ required: true, message: '请选择至少一个核心痛点' }]}>
              <Select mode="multiple" placeholder="选择原核心痛点（可多选）" options={PAIN_POINT_OPTIONS} />
            </Form.Item>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Form.Item name="monthly_saved_hours" label="月均节省工时" rules={[{ required: true, message: '请输入月均节省工时' }]}>
                <InputNumber
                  placeholder="如：40"
                  suffix="小时/月"
                  min={0}
                  className="w-full"
                />
              </Form.Item>

              <Form.Item name="efficiency_ratio" label="提效比例" rules={[{ required: true, message: '请输入提效比例' }]}>
                <InputNumber
                  placeholder="如：80"
                  suffix="%"
                  min={0}
                  max={100}
                  className="w-full"
                />
              </Form.Item>
            </div>
          </div>

          {/* AI 工具与 Demo */}
          <div className="mb-6">
            <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--foreground)' }}>AI 工具与 Demo</h3>
            <Form.Item name="ai_tools" label="用到的 AI 工具" rules={[{ required: true, message: '请选择至少一个 AI 工具' }]}>
              <Select mode="multiple" placeholder="选择用到的 AI 工具（可多选）" options={AI_TOOL_OPTIONS} />
            </Form.Item>

            <Form.Item name="demo_link" label="实现效果 Demo 链接" rules={[
              { required: true, message: '请输入 Demo 链接' },
              { type: 'url', message: '请输入有效的 URL' },
            ]}>
              <Input placeholder="产品演示 Demo 图片/视频/GitHub 仓库地址链接（请将所有内容放在同一个飞书云文档）" />
            </Form.Item>
          </div>

          {/* 其他价值 */}
          <div className="mb-6">
            <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--foreground)' }}>其他价值</h3>
            <Form.Item name="other_values" label="其他价值补充">
              <Select mode="multiple" placeholder="选择其他价值（非必填）" options={OTHER_VALUE_OPTIONS} allowClear />
            </Form.Item>
          </div>

          <Form.Item>
            <button
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              style={{ background: 'var(--primary)' }}
              type="submit"
              disabled={submitting}>
              <PlusOutlined /> {submitting ? '提交中...' : '提交案例'}
            </button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
