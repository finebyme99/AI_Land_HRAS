'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Input, Spin, Modal, Form, Select, App } from 'antd';
import {
  AppstoreOutlined,
  PlusOutlined,
  CameraOutlined,
  ArrowRightOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { normalizeDepartmentValues } from '@/lib/resources/departments';
import { useAuth } from '@/lib/auth-context';
import DepartmentSelect from '@/components/resources/DepartmentSelect';
import ResourceCard from '@/components/resources/ResourceCard';
import SearchInput from '@/components/SearchInput';
import type { Resource, ResourceCategory } from '@/types';
import { RESOURCE_CATEGORIES, ZONGTENG_SKILLS_CATEGORY } from '@/types';

const SCENARIO_OPTIONS = ['编程', '设计', '写作', '数据分析', '咨询搜集', '日常提效'];
const ZONGTENG_SKILLS_SUBMIT_HREF = `/resources/apps/create?category=${encodeURIComponent(ZONGTENG_SKILLS_CATEGORY)}`;

export default function AppsContent() {
  const { user, hasPermission } = useAuth();
  const canSubmitResource = hasPermission('resource.submit');
  const canGenerateFeishuCard = hasPermission('resource.generate-feishu-card');
  const canReviewResource = hasPermission('resource.review');
  const { message } = App.useApp();
  const [resources, setResources] = useState<Resource[]>([]);
  const [highlightedSkills, setHighlightedSkills] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState<ResourceCategory | ''>('');
  const [scenario, setScenario] = useState('');
  const [interactions, setInteractions] = useState<Record<string, { liked: boolean; bookmarked: boolean }>>({});
  const [counts, setCounts] = useState<Record<string, { like_count: number; bookmark_count: number }>>({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingCardId, setSendingCardId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const departmentSelectOptions = normalizeDepartmentValues([
    ...departmentOptions,
    ...(editing?.applicable_departments ?? []),
  ]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchHighlightedSkills = useCallback(async () => {
    try {
      const { data, error } = await getSupabase()
        .from('apps')
        .select('*, author:users!author_id(id, name, avatar)')
        .eq('status', 'published')
        .eq('category', ZONGTENG_SKILLS_CATEGORY)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      setHighlightedSkills((data ?? []) as Resource[]);
    } catch (err) {
      console.error('Failed to fetch Zongteng skills:', err);
      setHighlightedSkills([]);
    }
  }, []);

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
      if (scenario) query = query.contains('scenarios', [scenario]);

      const { data, error } = await query;
      if (error) throw error;
      setResources((data ?? []) as Resource[]);
    } catch (err) {
      console.error('Failed to fetch resources:', err);
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, category, scenario]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchResources(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchResources]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchHighlightedSkills(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchHighlightedSkills]);

  useEffect(() => {
    let active = true;

    fetch('/api/resources/departments')
      .then((res) => {
        if (!res.ok) throw new Error('部门选项加载失败');
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setDepartmentOptions(Array.isArray(data.departments) ? data.departments : []);
      })
      .catch((err) => {
        console.error('Failed to fetch department options:', err);
        if (active) setDepartmentOptions([]);
      });

    return () => {
      active = false;
    };
  }, []);

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
    if (canReviewResource) return true;
    if (res.author?.id === user.id) return true;
    return false;
  };

  const handleGenerateFeishuCard = async (resource: Resource) => {
    if (!user) {
      message.error('请先登录');
      return;
    }
    setSendingCardId(resource.id);
    try {
      const res = await fetch('/api/resources/card-to-me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: resource.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '发送失败');
      message.success('飞书卡片已发送给你');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '发送失败');
    } finally {
      setSendingCardId(null);
    }
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
      category: res.category,
      scenarios: res.scenarios,
      applicable_departments: res.applicable_departments ?? [],
      official_url: res.official_url,
    });
    setEditModalOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!canEdit(editing)) {
      message.error('无编辑权限');
      return;
    }
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
      await Promise.all([fetchResources(), fetchHighlightedSkills()]);
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-0">
      <section
        className="glass relative overflow-hidden rounded-[20px] p-5 sm:p-6 mb-6"
        style={{
          borderColor: 'rgba(242, 127, 34, 0.34)',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.76), rgba(255,244,232,0.78))',
          boxShadow: '0 18px 48px rgba(242,127,34,0.16)',
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: 'linear-gradient(90deg, var(--primary), var(--accent))' }}
        />
        <div className="mb-5 max-w-4xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: 'rgba(242,127,34,0.12)', color: 'var(--accent)' }}>
              <StarOutlined /> 纵腾人专属 Skills
            </div>
            <button
              onClick={() => setCategory(ZONGTENG_SKILLS_CATEGORY)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all hover:-translate-y-0.5"
              style={{ background: 'var(--primary)', color: '#fff', boxShadow: '0 4px 12px rgba(26,58,138,0.18)' }}
            >
              查看全部 <ArrowRightOutlined style={{ fontSize: 11 }} />
            </button>
            {canSubmitResource && (
              <Link href={ZONGTENG_SKILLS_SUBMIT_HREF}>
                <button
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all hover:-translate-y-0.5"
                  style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 4px 12px rgba(242,127,34,0.18)' }}
                >
                  <PlusOutlined /> 投稿 Skills
                </button>
              </Link>
            )}
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-2">把纵腾人的业务智慧沉淀成可复用 Skills</h2>
            <p className="text-sm max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
              展示内部同学制作、验证过的 Skills，优先服务纵腾真实业务场景，方便团队直接拿来改、拿来用。
            </p>
          </div>
        </div>

        {highlightedSkills.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {highlightedSkills.map((skill) => (
              <ResourceCard
                key={skill.id}
                resource={skill}
                allDepartments={departmentOptions}
                surface="soft"
                accent="orange"
                showCategory={false}
                showDates={false}
                compact
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl p-5 text-sm"
            style={{ background: 'rgba(255,255,255,0.56)', border: '1px dashed rgba(242,127,34,0.36)', color: 'var(--text-secondary)' }}>
            专区正在收集第一批内部 Skills。你可以用下方原有投稿入口提交，审核通过后会出现在这里。
          </div>
        )}
      </section>

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
          {RESOURCE_CATEGORIES.map((c) => {
            const isZongtengCategory = c === ZONGTENG_SKILLS_CATEGORY;
            const isActive = category === c;
            return (
              <button
                key={c}
                onClick={() => setCategory(isActive ? '' : c)}
                className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                style={{
                  color: isActive ? '#fff' : isZongtengCategory ? 'var(--accent)' : 'var(--text-secondary)',
                  background: isActive
                    ? isZongtengCategory ? 'linear-gradient(135deg, #F27F22, #e8650a)' : 'var(--primary)'
                    : isZongtengCategory ? 'rgba(242,127,34,0.1)' : 'rgba(255, 255, 255, 0.3)',
                  border: isZongtengCategory ? '1px solid rgba(242,127,34,0.2)' : '1px solid transparent',
                }}
              >{c}</button>
            );
          })}
        </div>
        {/* 适用场景筛选 - 标签式按钮 */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium shrink-0" style={{ color: 'var(--text-muted)' }}>场景</span>
          <button
            onClick={() => setScenario('')}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              color: !scenario ? '#fff' : 'var(--text-secondary)',
              background: !scenario ? 'var(--primary)' : 'rgba(255, 255, 255, 0.3)',
              border: '1px solid transparent',
            }}
          >全部</button>
          {SCENARIO_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setScenario(scenario === s ? '' : s)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                color: scenario === s ? '#fff' : 'var(--text-secondary)',
                background: scenario === s ? 'var(--primary)' : 'rgba(255, 255, 255, 0.3)',
                border: '1px solid transparent',
              }}
            >{s}</button>
          ))}
        </div>
        {/* 操作按钮 */}
        {canSubmitResource && (
          <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}>
            <Link href="/resources/apps/create">
              <button className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all hover:-translate-y-0.5"
                style={{ background: 'var(--primary)', color: '#fff' }}>
                <PlusOutlined /> 分享好用工具
              </button>
            </Link>
          </div>
        )}
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
            <ResourceCard
              key={res.id}
              resource={res}
              allDepartments={departmentOptions}
              canEdit={canEdit(res)}
              onEdit={openEdit}
              interactions={interactions[res.id]}
              counts={counts[res.id]}
              onToggleInteraction={toggleInteraction}
              onGenerateFeishuCard={canGenerateFeishuCard ? handleGenerateFeishuCard : undefined}
              generatingFeishuCard={sendingCardId === res.id}
            />
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

          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select options={RESOURCE_CATEGORIES.map(c => ({ label: c, value: c }))} />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input maxLength={80} showCount />
          </Form.Item>
          <Form.Item name="description" label="简介" rules={[{ required: true, message: '请输入简介' }]}>
            <Input placeholder="一句话介绍工具的核心亮点" maxLength={100} showCount />
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
          <Form.Item name="applicable_departments" label="适用部门" rules={[{ type: 'array', required: true, min: 1, message: '请选择适用部门' }]}>
            <DepartmentSelect options={departmentSelectOptions} />
          </Form.Item>
          <Form.Item name="official_url" label="使用指南链接" rules={[
            { required: true, message: '请输入使用指南链接' },
            { type: 'url', message: '请输入有效的 URL' },
          ]}>
            <Input placeholder="https://..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
