'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Tag, Input, Spin, Avatar, Modal, Form, Select, App } from 'antd';
import {
  AppstoreOutlined,
  LikeOutlined,
  LikeFilled,
  UserOutlined,
  PlusOutlined,
  LinkOutlined,
  BookOutlined,
  BookFilled,
  EditOutlined,
  CameraOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { RESOURCE_CATEGORY_COLORS } from '@/lib/constants';
import { useAuth } from '@/lib/auth-context';
import SearchInput from '@/components/SearchInput';
import type { Resource, ResourceCategory } from '@/types';
import { RESOURCE_CATEGORIES } from '@/types';

export default function AppsPage() {
  const { user, isAdmin } = useAuth();
  const { message } = App.useApp();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState<ResourceCategory | ''>('');
  const [interactions, setInteractions] = useState<Record<string, { liked: boolean; bookmarked: boolean }>>({});
  const [counts, setCounts] = useState<Record<string, { like_count: number; bookmark_count: number }>>({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      let query = getSupabase()
        .from('apps')
        .select('*, author:users!author_id(id, name, avatar)')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (debouncedSearch) query = query.or(`name.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`);
      if (category) query = query.eq('category', category);

      const { data, error } = await query;
      if (error) throw error;
      setResources((data ?? []) as Resource[]);
    } catch (err) {
      console.error('Failed to fetch resources:', err);
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, category]);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  // Fetch interaction states and counts
  useEffect(() => {
    if (resources.length === 0) return;
    const fetchInteractions = async () => {
      const interactionResults: Record<string, { liked: boolean; bookmarked: boolean }> = {};
      const countResults: Record<string, { like_count: number; bookmark_count: number }> = {};
      await Promise.all(
        resources.map(async (res) => {
          try {
            const [stateRes, countRes] = await Promise.all([
              user ? fetch(`/api/interactions?target_type=app&target_id=${res.id}`) : null,
              fetch(`/api/interactions?target_type=app&target_id=${res.id}&action=count`),
            ]);
            if (stateRes?.ok) {
              const data = await stateRes.json();
              interactionResults[res.id] = { liked: data.liked, bookmarked: data.bookmarked };
            }
            if (countRes.ok) {
              const data = await countRes.json();
              countResults[res.id] = { like_count: data.like_count ?? 0, bookmark_count: data.bookmark_count ?? 0 };
            }
          } catch {}
        })
      );
      setInteractions(interactionResults);
      setCounts(countResults);
    };
    fetchInteractions();
  }, [resources, user]);

  const toggleInteraction = async (resourceId: string, action: 'like' | 'bookmark') => {
    if (!user) return;
    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, target_type: 'app', target_id: resourceId }),
      });
      if (res.ok) {
        const { active } = await res.json();
        setInteractions((prev) => ({
          ...prev,
          [resourceId]: { ...prev[resourceId], [action === 'like' ? 'liked' : 'bookmarked']: active },
        }));
        const countRes = await fetch(`/api/interactions?target_type=app&target_id=${resourceId}&action=count`);
        if (countRes.ok) {
          const countData = await countRes.json();
          setCounts((prev) => ({
            ...prev,
            [resourceId]: { like_count: countData.like_count ?? 0, bookmark_count: countData.bookmark_count ?? 0 },
          }));
        }
      }
    } catch {}
  };

  const canEdit = (res: Resource) => {
    if (!user) return false;
    if (isAdmin) return true;
    if (res.author?.id === user.id) return true;
    return false;
  };

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

  const openEdit = (res: Resource) => {
    setEditing(res);
    setLogoUrl(res.logo || null);
    form.setFieldsValue({
      name: res.name,
      description: res.description,
      content: res.content,
      category: res.category,
      scenarios: res.scenarios,
      official_url: res.official_url,
    });
    setEditModalOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const values = await form.validateFields();
      const res = await fetch('/api/resources/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, ...values, logo: logoUrl || '' }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '保存失败');
      }
      message.success('已保存');
      setEditModalOpen(false);
      setEditing(null);
      fetchResources();
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base"
              style={{ background: 'rgba(120, 80, 160, 0.08)', color: '#7850a0' }}>
              <AppstoreOutlined />
            </span>
            工具推荐
          </h1>
          <p className="text-sm mt-1 ml-12" style={{ color: 'var(--text-secondary)' }}>发现好用的 AI 工具与 Skills</p>
        </div>
        <Link href="/apps/create">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ color: 'var(--primary)', border: '1px solid var(--primary)' }}>
            <PlusOutlined /> 分享好用工具
          </button>
        </Link>
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-4 mb-6 space-y-3" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex flex-wrap gap-3 items-center">
          <SearchInput
            placeholder="搜索工具..."
            className="w-full sm:w-64"
            value={search}
            onChange={setSearch}
          />
        </div>
        {/* 分类筛选 - 标签式按钮 */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium shrink-0" style={{ color: 'var(--text-muted)' }}>分类</span>
          <button
            onClick={() => setCategory('')}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              color: !category ? '#fff' : 'var(--text-secondary)',
              background: !category ? 'var(--primary)' : 'rgba(255, 255, 255, 0.3)',
              border: '1px solid transparent',
            }}
          >全部</button>
          {RESOURCE_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(category === c ? '' : c)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                color: category === c ? '#fff' : 'var(--text-secondary)',
                background: category === c ? 'var(--primary)' : 'rgba(255, 255, 255, 0.3)',
                border: '1px solid transparent',
              }}
            >{c}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20"><Spin size="large" /></div>
      ) : resources.length === 0 ? (
        <div className="text-center py-16 glass rounded-[20px]" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <AppstoreOutlined className="text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>暂无工具</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map((res) => (
            <div key={res.id} className="glass relative overflow-hidden rounded-[20px] p-5 h-full transition-all duration-300 hover:-translate-y-1 group"
              style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
              <div className="absolute top-0 left-0 w-full h-[3px] opacity-0 hover:opacity-100 transition-opacity" style={{ background: 'var(--gradient-primary)' }} />
              {/* 编辑按钮 */}
              {canEdit(res) && (
                <button
                  onClick={() => openEdit(res)}
                  className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 transition-all"
                  style={{ background: 'rgba(255,255,255,0.8)', color: 'var(--text-secondary)' }}
                  title="编辑"
                >
                  <EditOutlined style={{ fontSize: 13 }} />
                </button>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold overflow-hidden"
                  style={{ background: 'rgba(26, 58, 138, 0.06)', color: 'var(--primary)' }}>
                  {res.logo ? (
                    <img src={res.logo} alt={res.name} className="w-full h-full object-cover" />
                  ) : (
                    res.name[0]
                  )}
                </div>
                <div>
                  <h3 className="text-base font-semibold">{res.name}</h3>
                  <Tag color={(RESOURCE_CATEGORY_COLORS as Record<string, string>)[res.category] ?? 'default'}>{res.category}</Tag>
                </div>
              </div>
              <p className="text-sm mb-2 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{res.description}</p>
              {res.official_url && (
                <a href={res.official_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] font-medium mb-3 hover:underline"
                  style={{ color: 'var(--primary)' }}>
                  <LinkOutlined /> 访问链接
                </a>
              )}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {res.scenarios.map((s) => (
                  <Tag key={s} className="text-xs">{s}</Tag>
                ))}
              </div>
              {/* 日期信息 */}
              <div className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>
                <span>发布 {new Date(res.created_at).toLocaleDateString('zh-CN')}</span>
                {res.updated_at && res.updated_at !== res.created_at && (
                  <span className="ml-2">更新 {new Date(res.updated_at).toLocaleDateString('zh-CN')}</span>
                )}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
                  <span
                    className="flex items-center gap-1 cursor-pointer transition-colors hover:text-red-500"
                    style={{ color: interactions[res.id]?.liked ? '#e74c3c' : undefined }}
                    onClick={() => toggleInteraction(res.id, 'like')}
                  >
                    {interactions[res.id]?.liked ? <LikeFilled /> : <LikeOutlined />} {counts[res.id]?.like_count ?? 0}
                  </span>
                  <span
                    className="flex items-center gap-1 cursor-pointer transition-colors hover:text-yellow-500"
                    style={{ color: interactions[res.id]?.bookmarked ? '#f59e0b' : undefined }}
                    onClick={() => toggleInteraction(res.id, 'bookmark')}
                  >
                    {interactions[res.id]?.bookmarked ? <BookFilled /> : <BookOutlined />} {counts[res.id]?.bookmark_count ?? 0}
                  </span>
                </span>
                {res.author?.name && (
                  <span className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <Avatar src={res.author.avatar || undefined} icon={<UserOutlined />} size={18} />
                    <span className="text-[11px]">{res.author.name}</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑弹窗 */}
      <Modal
        title="编辑工具"
        open={editModalOpen}
        onCancel={() => { setEditModalOpen(false); setEditing(null); }}
        onOk={handleSave}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical" className="mt-4">
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
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>点击更换图片</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>支持 JPG/PNG/SVG，不超过 500KB</p>
              </div>
            </div>
          </Form.Item>

          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input maxLength={80} showCount />
          </Form.Item>
          <Form.Item name="description" label="简介" rules={[{ required: true, message: '请输入简介' }]}>
            <Input.TextArea rows={2} maxLength={200} showCount />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select options={RESOURCE_CATEGORIES.map(c => ({ label: c, value: c }))} />
          </Form.Item>
          <Form.Item name="scenarios" label="适用场景">
            <Select mode="multiple" placeholder="选择适用场景" options={[
              { label: '对话', value: '对话' },
              { label: '任务执行', value: '任务执行' },
              { label: '编程', value: '编程' },
            ]} />
          </Form.Item>
          <Form.Item name="official_url" label="官网 / 链接">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="content" label="详细说明">
            <Input.TextArea rows={4} placeholder="功能介绍、使用技巧等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
