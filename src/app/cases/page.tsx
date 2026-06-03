'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Tag, Select, Radio, Empty, Spin, Pagination } from 'antd';
import {
  EyeOutlined,
  LikeOutlined,
  BookOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { CATEGORY_COLORS, CASE_CATEGORIES, CASE_CATEGORY_OPTIONS, CASE_TEAMS, CASE_BUSINESS_SCENARIOS } from '@/lib/constants';
import SearchInput from '@/components/SearchInput';
import type { Case, CaseCategory, CaseTeam, CaseBusinessScenario } from '@/types';

export default function CasesPage() {
  const { isAdmin } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState<CaseCategory | ''>('');
  const [team, setTeam] = useState<CaseTeam | ''>('');
  const [businessScenario, setBusinessScenario] = useState<CaseBusinessScenario | ''>('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const pageSize = 12;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [category, team, businessScenario, debouncedSearch, sortBy]);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const ascending = sortBy === 'created_at' ? false : false;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = getSupabase()
        .from('cases')
        .select('*, author:users!author_id(id, name, avatar, department)', { count: 'exact' })
        .eq('status', 'published')
        .order(sortBy, { ascending })
        .range(from, to);

      if (category) query = query.eq('category', category);
      if (team) query = query.eq('team', team);
      if (businessScenario) query = query.eq('business_scenario', businessScenario);
      if (debouncedSearch) query = query.or(`title.ilike.%${debouncedSearch}%,summary.ilike.%${debouncedSearch}%`);

      const { data, error, count } = await query;
      if (error) throw error;
      setCases((data ?? []) as Case[]);
      setTotal(count ?? 0);
    } catch (err) {
      console.error('Failed to fetch cases:', err);
      setCases([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [category, team, businessScenario, debouncedSearch, sortBy, page]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(26, 58, 138, 0.1)', color: 'var(--primary)' }}>
              <BookOutlined />
            </span>
            案例库
          </h1>
          <p className="text-sm mt-1 ml-12" style={{ color: 'var(--text-secondary)' }}>来自 HR 实践者的 AI 应用案例</p>
        </div>
        {isAdmin && (
          <Link href="/cases/create">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ background: 'var(--primary)' }}>
              <PlusOutlined /> 提交案例
            </button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-4 mb-6 space-y-3" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex flex-wrap gap-3 items-center">
          <SearchInput
            placeholder="搜索案例..."
            className="w-full sm:w-64"
            value={search}
            onChange={setSearch}
          />
          <Select
            placeholder="HR 模块"
            className="w-full sm:w-48"
            value={category || undefined}
            onChange={(v) => setCategory(v || '')}
            allowClear
            options={CASE_CATEGORY_OPTIONS}
          />
          <Select
            placeholder="排序"
            className="w-full sm:w-36"
            value={sortBy}
            onChange={setSortBy}
            options={[
              { label: '最新发布', value: 'created_at' },
              { label: '最多浏览', value: 'view_count' },
              { label: '最多点赞', value: 'like_count' },
              { label: '最多收藏', value: 'bookmark_count' },
            ]}
          />
          <Radio.Group value={viewMode} onChange={(e) => setViewMode(e.target.value)} size="small">
            <Radio.Button value="card"><AppstoreOutlined /></Radio.Button>
            <Radio.Button value="list"><UnorderedListOutlined /></Radio.Button>
          </Radio.Group>
        </div>
        {/* 提报团队 */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium shrink-0" style={{ color: 'var(--text-muted)' }}>提报团队</span>
          <button
            onClick={() => setTeam('')}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              color: !team ? '#fff' : 'var(--text-secondary)',
              background: !team ? 'var(--primary)' : 'rgba(255, 255, 255, 0.3)',
              border: '1px solid transparent',
            }}
          >全部</button>
          {CASE_TEAMS.map((t) => (
            <button
              key={t}
              onClick={() => setTeam(team === t ? '' : t)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                color: team === t ? '#fff' : 'var(--text-secondary)',
                background: team === t ? 'var(--primary)' : 'rgba(255, 255, 255, 0.3)',
                border: '1px solid transparent',
              }}
            >{t}</button>
          ))}
        </div>
        {/* 业务场景 */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium shrink-0" style={{ color: 'var(--text-muted)' }}>业务场景</span>
          <button
            onClick={() => setBusinessScenario('')}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              color: !businessScenario ? '#fff' : 'var(--text-secondary)',
              background: !businessScenario ? 'var(--primary)' : 'rgba(255, 255, 255, 0.3)',
              border: '1px solid transparent',
            }}
          >全部</button>
          {CASE_BUSINESS_SCENARIOS.map((s) => (
            <button
              key={s}
              onClick={() => setBusinessScenario(businessScenario === s ? '' : s)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                color: businessScenario === s ? '#fff' : 'var(--text-secondary)',
                background: businessScenario === s ? 'var(--primary)' : 'rgba(255, 255, 255, 0.3)',
                border: '1px solid transparent',
              }}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      {!loading && total > 0 && (
        <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          共 {total} 个案例
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-20"><Spin size="large" /></div>
      ) : cases.length === 0 ? (
        <div className="text-center py-16 glass rounded-[20px]" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <BookOutlined className="text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>暂无案例</p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cases.map((c) => (
            <Link key={c.id} href={`/cases/${c.id}`} className="block group">
              <div className="glass relative overflow-hidden rounded-[20px] p-5 h-full transition-all duration-300 hover:-translate-y-1"
                style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
                <div className="absolute top-0 left-0 w-full h-[3px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'var(--gradient-primary)' }} />
                <div className="flex items-start gap-2 mb-3">
                  <Tag color={CATEGORY_COLORS[c.category]}>{c.category}</Tag>
                  {c.team && <Tag color="blue">{c.team}</Tag>}
                  {c.business_scenario && <Tag color="cyan">{c.business_scenario}</Tag>}
                  {c.event_id && <Tag color="red">大赛作品</Tag>}
                  {c.is_featured && <Tag color="orange">精选</Tag>}
                </div>
                <h3 className="text-base font-semibold mb-2 line-clamp-2 group-hover:opacity-80 transition-opacity">
                  {c.title}
                </h3>
                <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{c.summary}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {c.ai_tools.map((tool) => (
                    <Tag key={tool} className="text-xs">{tool}</Tag>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>{c.author.name} · {c.author.department}</span>
                  <span className="flex items-center gap-3">
                    <span><EyeOutlined /> {c.view_count}</span>
                    <span><LikeOutlined /> {c.like_count}</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cases.map((c) => (
            <Link key={c.id} href={`/cases/${c.id}`} className="block group">
              <div className="glass relative overflow-hidden rounded-[20px] px-5 py-4 transition-all duration-300 hover:-translate-y-0.5"
                style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Tag color={CATEGORY_COLORS[c.category]}>{c.category}</Tag>
                      {c.team && <Tag color="blue">{c.team}</Tag>}
                      {c.business_scenario && <Tag color="cyan">{c.business_scenario}</Tag>}
                      {c.is_featured && <Tag color="orange">精选</Tag>}
                    </div>
                    <h3 className="text-sm font-semibold truncate group-hover:opacity-80 transition-opacity">{c.title}</h3>
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>{c.summary}</p>
                  </div>
                  <div className="text-xs flex-shrink-0 text-right" style={{ color: 'var(--text-muted)' }}>
                    <div>{c.author.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span><EyeOutlined /> {c.view_count}</span>
                      <span><LikeOutlined /> {c.like_count}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex justify-center mt-6">
          <Pagination
            current={page}
            total={total}
            pageSize={pageSize}
            onChange={setPage}
            showSizeChanger={false}
            showTotal={(t) => `共 ${t} 个案例`}
          />
        </div>
      )}
    </div>
  );
}
