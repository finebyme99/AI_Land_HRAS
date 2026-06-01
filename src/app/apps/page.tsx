'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Tag, Select, Input, Spin, Tabs } from 'antd';
import {
  AppstoreOutlined,
  LikeOutlined,
  DislikeOutlined,
  StarFilled,
  UserOutlined,
  PlusOutlined,
  ReadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { RESOURCE_CATEGORY_COLORS, RESOURCE_TYPE_TABS, getResourceCategories } from '@/lib/constants';
import type { Resource, ResourceType, ResourceCategory } from '@/types';

const RESOURCE_TYPE_ICONS: Record<ResourceType, React.ReactNode> = {
  ai_tool: <AppstoreOutlined />,
  guide: <ReadOutlined />,
  skill: <ThunderboltOutlined />,
};

export default function AppsPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [resourceType, setResourceType] = useState<ResourceType>('ai_tool');
  const [category, setCategory] = useState<ResourceCategory | ''>('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  /** 切换资源类型时重置分类 */
  const handleTypeChange = (key: string) => {
    setResourceType(key as ResourceType);
    setCategory('');
  };

  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      let query = getSupabase()
        .from('apps')
        .select('*')
        .eq('status', 'published')
        .eq('resource_type', resourceType)
        .order('rating', { ascending: false });

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
  }, [debouncedSearch, category, resourceType]);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  const categories = getResourceCategories(resourceType);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(120, 80, 160, 0.08)', color: '#7850a0' }}>
              <AppstoreOutlined />
            </span>
            资源推荐
          </h1>
          <p className="text-sm mt-1 ml-12" style={{ color: 'var(--text-secondary)' }}>发现 AI 工具、操作指引与 Skills</p>
        </div>
        <Link href="/apps/create">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <PlusOutlined /> 提交资源
          </button>
        </Link>
      </div>

      {/* Resource Type Tabs */}
      <Tabs
        activeKey={resourceType}
        onChange={handleTypeChange}
        items={RESOURCE_TYPE_TABS.map((tab) => ({
          key: tab.key,
          label: (
            <span className="flex items-center gap-1.5">
              {RESOURCE_TYPE_ICONS[tab.key]}
              {tab.label}
            </span>
          ),
        }))}
        className="mb-4"
      />

      {/* Filters */}
      <div className="glass rounded-xl p-4 mb-6" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex flex-wrap gap-3 items-center">
          <Input.Search
            placeholder={`搜索${RESOURCE_TYPE_TABS.find(t => t.key === resourceType)?.label ?? '资源'}...`}
            className="w-full sm:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
          <Select
            placeholder="分类"
            className="w-full sm:w-36"
            value={category || undefined}
            onChange={(v) => setCategory(v || '')}
            allowClear
            options={categories.map((c) => ({ label: c, value: c }))}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20"><Spin size="large" /></div>
      ) : resources.length === 0 ? (
        <div className="text-center py-16 glass rounded-[20px]" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <AppstoreOutlined className="text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>暂无{RESOURCE_TYPE_TABS.find(t => t.key === resourceType)?.label ?? '资源'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map((res) => (
            <Link key={res.id} href={`/apps/${res.id}`} className="block group">
              <div className="glass relative overflow-hidden rounded-[20px] p-5 h-full transition-all duration-300 hover:-translate-y-1"
                style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
                <div className="absolute top-0 left-0 w-full h-[3px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'var(--gradient-primary)' }} />
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold"
                    style={{ background: 'rgba(26, 58, 138, 0.06)', color: 'var(--primary)' }}>
                    {res.name[0]}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold group-hover:opacity-80 transition-opacity">{res.name}</h3>
                    <Tag color={RESOURCE_CATEGORY_COLORS[res.category]}>{res.category}</Tag>
                  </div>
                </div>
                <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{res.description}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {res.scenarios.map((s) => (
                    <Tag key={s} className="text-xs">{s}</Tag>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1" style={{ color: '#c4883a' }}>
                    <StarFilled /> {res.rating}
                  </span>
                  <span className="flex items-center gap-3">
                    <span><LikeOutlined /> {res.like_count}</span>
                    <span><DislikeOutlined /> {res.dislike_count}</span>
                    <span><UserOutlined /> {res.user_count}</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
