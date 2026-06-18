'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Tag, Select, Radio, Empty, Spin, Pagination, Modal, Form, Input, InputNumber, App } from 'antd';
import {
  EyeOutlined,
  LikeOutlined,
  BookOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  PlusOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import {
  CATEGORY_COLORS, CASE_CATEGORIES, CASE_CATEGORY_OPTIONS,
  CASE_TEAMS, CASE_TEAM_OPTIONS, CASE_BUSINESS_SCENARIOS, CASE_BUSINESS_SCENARIO_OPTIONS,
  AI_TOOL_OPTIONS, PAIN_POINT_OPTIONS, OTHER_VALUE_OPTIONS,
} from '@/lib/constants';
import SearchInput from '@/components/SearchInput';
import HighlightSweep from '@/components/HighlightSweep';
import type { Case, CaseCategory, CaseTeam, CaseBusinessScenario } from '@/types';

export default function CasesPage() {
  const { user, isAdmin } = useAuth();
  const { message } = App.useApp();
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

  // 编辑弹窗
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState<Case | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [userList, setUserList] = useState<{ id: string; name: string; avatar: string; department: string }[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [category, team, businessScenario, debouncedSearch, sortBy]);

  // 获取用户列表（用于开发者选择）
  useEffect(() => {
    if (!user) return;
    fetch('/api/users/list')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.users) setUserList(data.users); })
      .catch(() => {});
  }, [user]);

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

  const canEdit = (c: Case) => {
    if (!user) return false;
    if (isAdmin) return true;
    if (c.author?.id === user.id) return true;
    return false;
  };

  const openEdit = async (c: Case) => {
    setEditing(c);
    // 获取 developers
    let developerIds: string[] = [];
    try {
      const res = await fetch(`/api/cases/${c.id}`);
      if (res.ok) {
        const data = await res.json();
        developerIds = (data.developers ?? []).map((d: { id: string }) => d.id);
      }
    } catch {}
    if (developerIds.length === 0) developerIds = c.author?.id ? [c.author.id] : [];

    form.setFieldsValue({
      title: c.title,
      summary: c.summary,
      content: c.content,
      category: c.category,
      team: c.team,
      business_scenario: c.business_scenario,
      team_members: c.team_members,
      original_business_scenario: c.original_business_scenario,
      pain_points: c.pain_points,
      monthly_saved_hours: c.monthly_saved_hours,
      efficiency_ratio: c.efficiency_ratio,
      ai_tools: c.ai_tools,
      demo_link: c.demo_link,
      other_values: c.other_values,
      developers: developerIds,
    });
    setEditModalOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const values = await form.validateFields();
      const res = await fetch('/api/cases/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, ...values }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '保存失败');
      }
      message.success('已保存');
      setEditModalOpen(false);
      setEditing(null);
      fetchCases();
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-[100px]" style={{ paddingTop: 20 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        {user && (
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
            <div key={c.id} className="relative group">
              <Link href={`/cases/${c.id}`} className="block">
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
              {canEdit(c) && (
                <button
                  onClick={(e) => { e.preventDefault(); openEdit(c); }}
                  className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 transition-all z-10"
                  style={{ background: 'rgba(255,255,255,0.8)', color: 'var(--text-secondary)' }}
                  title="编辑"
                >
                  <EditOutlined style={{ fontSize: 13 }} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cases.map((c) => (
            <div key={c.id} className="relative group">
              <Link href={`/cases/${c.id}`} className="block">
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
              {canEdit(c) && (
                <button
                  onClick={(e) => { e.preventDefault(); openEdit(c); }}
                  className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 transition-all z-10"
                  style={{ background: 'rgba(255,255,255,0.8)', color: 'var(--text-secondary)' }}
                  title="编辑"
                >
                  <EditOutlined style={{ fontSize: 13 }} />
                </button>
              )}
            </div>
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

      {/* 编辑弹窗 */}
      <Modal
        title="编辑案例"
        open={editModalOpen}
        onCancel={() => { setEditModalOpen(false); setEditing(null); }}
        onOk={handleSave}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={720}
      >
        <Form form={form} layout="vertical" className="mt-4 max-h-[65vh] overflow-y-auto pr-2">
          {/* 开发者 */}
          <Form.Item name="developers" label="开发者" rules={[{ required: true, message: '请选择开发者' }]}>
            <Select
              mode="multiple"
              placeholder="选择开发者"
              options={userList.map(u => ({ label: `${u.name}（${u.department || '-'}）`, value: u.id }))}
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
              }
            />
          </Form.Item>

          <Form.Item name="title" label="案例标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input maxLength={100} showCount />
          </Form.Item>

          <Form.Item name="summary" label="摘要" rules={[{ required: true, message: '请输入摘要' }]}>
            <Input.TextArea rows={2} maxLength={300} showCount />
          </Form.Item>

          <Form.Item name="content" label="详细内容" rules={[{ required: true, message: '请输入内容' }]}>
            <Input.TextArea rows={6} />
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Form.Item name="team" label="提报团队" rules={[{ required: true, message: '请选择提报团队' }]}>
              <Select options={CASE_TEAM_OPTIONS} />
            </Form.Item>
            <Form.Item name="business_scenario" label="业务场景" rules={[{ required: true, message: '请选择业务场景' }]}>
              <Select options={CASE_BUSINESS_SCENARIO_OPTIONS} />
            </Form.Item>
          </div>

          <Form.Item name="team_members" label="案例小组成员" rules={[{ required: true, message: '请输入案例小组成员' }]}>
            <Input placeholder="用逗号分隔" />
          </Form.Item>

          <Form.Item name="category" label="提效/增值场景分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select options={CASE_CATEGORY_OPTIONS} />
          </Form.Item>

          <Form.Item name="original_business_scenario" label="原业务场景" rules={[{ required: true, message: '请输入原业务场景' }]}>
            <Input />
          </Form.Item>

          <Form.Item name="pain_points" label="原核心痛点" rules={[{ required: true, message: '请选择痛点' }]}>
            <Select mode="multiple" options={PAIN_POINT_OPTIONS} />
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Form.Item name="monthly_saved_hours" label="月均节省工时" rules={[{ required: true, message: '请输入' }]}>
              <InputNumber suffix="小时/月" min={0} className="w-full" />
            </Form.Item>
            <Form.Item name="efficiency_ratio" label="提效比例" rules={[{ required: true, message: '请输入' }]}>
              <InputNumber suffix="%" min={0} max={100} className="w-full" />
            </Form.Item>
          </div>

          <Form.Item name="ai_tools" label="用到的 AI 工具" rules={[{ required: true, message: '请选择' }]}>
            <Select mode="multiple" options={AI_TOOL_OPTIONS} />
          </Form.Item>

          <Form.Item name="demo_link" label="实现效果 Demo 链接" rules={[
            { required: true, message: '请输入链接' },
            { type: 'url', message: '请输入有效 URL' },
          ]}>
            <Input placeholder="飞书云文档链接" />
          </Form.Item>

          <Form.Item name="other_values" label="其他价值补充">
            <Select mode="multiple" options={OTHER_VALUE_OPTIONS} allowClear />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
