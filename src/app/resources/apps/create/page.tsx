'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Form, Input, Select, App, Spin, Avatar } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, AppstoreOutlined, CameraOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import { RESOURCE_CATEGORIES } from '@/types';

export default function CreateResourcePage() {
  const { user, hasPermission } = useAuth();
  const canSubmitResource = hasPermission('resource.submit');
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      message.error('仅支持图片格式');
      return;
    }
    if (file.size > 500 * 1024) {
      message.error('图片大小不能超过 500KB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/apps/logo', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '上传失败');
      setLogoUrl(data.url);
      message.success('图片已上传');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!user) {
      message.error('请先登录');
      return;
    }
    if (!canSubmitResource) {
      message.error('无工具提交权限');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          description: values.description,
          category: values.category,
          scenarios: values.scenarios || [],
          official_url: values.official_url || '',
          logo: logoUrl || '',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '提交失败');
      }
      const data = await res.json();
      if (data.status === 'published') {
        message.success('工具已发布');
      } else {
        message.success('工具已提交，等待审核');
      }
      window.location.href = '/resources?tab=apps';
    } catch (err) {
      console.error('Failed to create resource:', err);
      message.error(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="glass rounded-2xl p-8 text-center" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>请先登录后再提交工具</p>
          <Link href="/login" className="text-sm font-medium" style={{ color: 'var(--primary)' }}>去登录</Link>
        </div>
      </div>
    );
  }

  if (!canSubmitResource) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="glass rounded-2xl p-8 text-center" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>暂无工具提交权限</p>
          <Link href="/resources?tab=apps" className="text-sm font-medium" style={{ color: 'var(--primary)' }}>返回工具列表</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link href="/resources?tab=apps" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeftOutlined /> 返回工具列表
      </Link>

      <h1 className="text-2xl font-bold mb-6 flex items-center gap-3">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base"
          style={{ background: 'rgba(120, 80, 160, 0.08)', color: '#7850a0' }}>
          <AppstoreOutlined />
        </span>
        提交工具
      </h1>

      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {/* 工具图片 */}
          <Form.Item label="工具图片">
            <div className="flex items-center gap-4">
              <div className="relative cursor-pointer group" onClick={handleLogoClick}>
                <div className="w-20 h-20 rounded-xl flex items-center justify-center overflow-hidden"
                  style={{ border: '2px dashed var(--border-light)', background: 'rgba(255,255,255,0.3)' }}>
                  {logoUrl ? (
                    <img src={logoUrl} alt="工具图片" className="w-full h-full object-cover" />
                  ) : (
                    <AppstoreOutlined style={{ fontSize: 24, color: 'var(--text-muted)' }} />
                  )}
                </div>
                <div className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.45)' }}>
                  <CameraOutlined style={{ color: '#fff', fontSize: 18 }} />
                </div>
                {uploading && (
                  <div className="absolute inset-0 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.45)' }}>
                    <Spin size="small" />
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*,.svg" className="hidden" onChange={handleFileChange} />
              <div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>上传工具图片</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>支持 JPG/PNG/SVG，不超过 500KB</p>
              </div>
            </div>
          </Form.Item>

          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：ChatGPT、Claude、Dify" maxLength={80} showCount />
          </Form.Item>

          <Form.Item name="description" label="简介" rules={[{ required: true, message: '请输入简介' }]}>
            <Input placeholder="一句话介绍工具的核心亮点，为你的推荐打好广告" maxLength={100} showCount />
          </Form.Item>

          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select placeholder="选择分类" options={RESOURCE_CATEGORIES.map(c => ({ label: c, value: c }))} />
          </Form.Item>

          <Form.Item name="scenarios" label="适用场景" rules={[{ required: true, message: '请选择适用场景' }]}>
            <Select mode="multiple" placeholder="选择适用场景（可多选）" options={[
              { label: '编程', value: '编程' },
              { label: '设计', value: '设计' },
              { label: '写作', value: '写作' },
              { label: '数据分析', value: '数据分析' },
              { label: '咨询搜集', value: '咨询搜集' },
              { label: '日常提效', value: '日常提效' },
            ]} />
          </Form.Item>

          <Form.Item name="official_url" label="使用指南链接" rules={[
            { required: true, message: '请输入使用指南链接' },
            { type: 'url', message: '请输入有效的 URL' },
          ]}>
            <Input placeholder="https://..." />
          </Form.Item>

          <Form.Item>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
            >
              <PlusOutlined /> {submitting ? '提交中...' : '提交'}
            </button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
