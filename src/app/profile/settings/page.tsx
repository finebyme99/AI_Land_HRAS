'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Form, Input, Avatar, App, Spin } from 'antd';
import { ArrowLeftOutlined, UserOutlined, SettingOutlined, CameraOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import { getSupabase } from '@/lib/supabase';

export default function SettingsPage() {
  const { user, loading, refreshUser } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="text-center py-16 glass rounded-2xl" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <p style={{ color: 'var(--text-muted)' }}>请先登录</p>
        </div>
      </div>
    );
  }

  const handleAvatarClick = () => {
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

    // 预览
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewUrl(ev.target?.result as string);
    reader.readAsDataURL(file);

    // 上传
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/user/avatar', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '上传失败');
      message.success('头像已更新');
      setPreviewUrl(null);
      await refreshUser();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '上传失败');
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async (values: Record<string, unknown>) => {
    try {
      const { error } = await getSupabase()
        .from('users')
        .update({ bio: values.bio as string })
        .eq('id', user.id);
      if (error) throw error;
      message.success('设置已保存');
    } catch {
      message.error('保存失败，请重试');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link href="/profile" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeftOutlined /> 返回个人中心
      </Link>

      <h1 className="text-2xl font-semibold flex items-center gap-3 mb-6">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(26, 58, 138, 0.1)', color: 'var(--primary)' }}>
          <SettingOutlined />
        </span>
        个人设置
      </h1>

      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        {/* 头像区域 */}
        <div className="flex items-center gap-4 mb-6 pb-6" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.5)' }}>
          <div className="relative cursor-pointer group" onClick={handleAvatarClick}>
            <Avatar size={72} src={previewUrl || user.avatar || undefined} icon={<UserOutlined />}
              style={{ border: '3px solid var(--border-light)' }} />
            <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.45)' }}>
              <CameraOutlined style={{ color: '#fff', fontSize: 20 }} />
            </div>
            {uploading && (
              <div className="absolute inset-0 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.45)' }}>
                <Spin size="small" />
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{user.name}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>点击头像更换，支持 JPG/PNG，不超过 500KB</p>
          </div>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            name: user.name,
            department: user.department,
            bio: user.bio,
          }}
        >
          <Form.Item name="name" label="用户名">
            <Input disabled />
          </Form.Item>

          <Form.Item name="department" label="部门">
            <Input disabled />
          </Form.Item>

          <Form.Item name="bio" label="个人简介">
            <Input.TextArea rows={3} placeholder="介绍一下你自己" maxLength={200} showCount />
          </Form.Item>

          <Form.Item>
            <button className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ background: 'var(--primary)' }}
              type="submit">
              保存设置
            </button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
