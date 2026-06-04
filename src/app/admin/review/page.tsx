'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Table, Tag, Button, Input, Select, Spin, Popconfirm, Tabs, App } from 'antd';
import { SearchOutlined, CheckCircleOutlined, CloseCircleOutlined, AppstoreOutlined, LinkOutlined, BookOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import { RESOURCE_CATEGORY_COLORS, CATEGORY_COLORS, CASE_TEAM_OPTIONS } from '@/lib/constants';
import type { ColumnsType } from 'antd/es/table';
import type { CaseCategory, CaseTeam } from '@/types';

// ========== 共用常量 ==========
const STATUS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待审核' },
  { value: 'published', label: '已发布' },
  { value: 'rejected', label: '已驳回' },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'orange' },
  published: { label: '已发布', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
};

// ========== 工具审核 ==========
interface ResourceItem {
  id: string;
  name: string;
  description: string;
  category: string;
  scenarios: string[];
  official_url: string;
  logo: string;
  status: 'pending' | 'published' | 'rejected';
  author_id: string | null;
  created_at: string;
}

function ToolReviewTab() {
  const { message } = App.useApp();
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});

  const fetchResources = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/resources/admin');
      if (!res.ok) throw new Error('获取失败');
      const data = await res.json();
      setResources(data.resources ?? []);

      const authorIds = [...new Set(data.resources.map((r: ResourceItem) => r.author_id).filter(Boolean))];
      if (authorIds.length > 0) {
        const usersRes = await fetch('/api/admin/users');
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          const nameMap: Record<string, string> = {};
          for (const u of usersData.users ?? []) {
            nameMap[u.id] = u.name || u.id;
          }
          setAuthorNames(nameMap);
        }
      }
    } catch {
      message.error('获取工具列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchResources(); }, []);

  const handleReview = async (id: string, status: 'published' | 'rejected') => {
    try {
      const res = await fetch('/api/resources', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error('操作失败');
      message.success(status === 'published' ? '已通过' : '已驳回');
      fetchResources();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const filtered = resources.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
    }
    return true;
  });

  const columns: ColumnsType<ResourceItem> = [
    {
      title: '图片', dataIndex: 'logo', key: 'logo', width: 60,
      render: (val: string) => val ? (
        <img src={val} alt="" className="w-10 h-10 rounded-lg object-cover" />
      ) : (
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(26, 58, 138, 0.06)' }}>
          <AppstoreOutlined style={{ color: 'var(--text-muted)' }} />
        </div>
      ),
    },
    { title: '名称', dataIndex: 'name', key: 'name', width: 140, ellipsis: true },
    { title: '简介', dataIndex: 'description', key: 'description', width: 180, ellipsis: true },
    {
      title: '分类', dataIndex: 'category', key: 'category', width: 120,
      render: (val: string) => <Tag color={(RESOURCE_CATEGORY_COLORS as Record<string, string>)[val] ?? 'default'}>{val}</Tag>,
    },
    {
      title: '链接', dataIndex: 'official_url', key: 'url', width: 80,
      render: (val: string) => val ? (
        <a href={val} target="_blank" rel="noopener noreferrer" className="text-xs" style={{ color: 'var(--primary)' }}>
          <LinkOutlined /> 访问
        </a>
      ) : '-',
    },
    {
      title: '提交人', key: 'author', width: 80,
      render: (_, r) => r.author_id ? (authorNames[r.author_id] ?? r.author_id.slice(0, 8)) : '-',
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (val: string) => {
        const s = STATUS_MAP[val];
        return s ? <Tag color={s.color}>{s.label}</Tag> : val;
      },
    },
    {
      title: '提交时间', dataIndex: 'created_at', key: 'created_at', width: 140,
      render: (val: string) => new Date(val).toLocaleString('zh-CN'),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      defaultSortOrder: 'descend',
    },
    {
      title: '操作', key: 'action', width: 150,
      render: (_, r) => (
        <div className="flex gap-2 items-center">
          {r.status === 'pending' && (
            <>
              <Popconfirm title="确认通过？" onConfirm={() => handleReview(r.id, 'published')}>
                <Button type="primary" size="small" icon={<CheckCircleOutlined />}>通过</Button>
              </Popconfirm>
              <Popconfirm title="确认驳回？" onConfirm={() => handleReview(r.id, 'rejected')}>
                <Button danger size="small" icon={<CloseCircleOutlined />}>驳回</Button>
              </Popconfirm>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          待审核 <b style={{ color: '#d46b08' }}>{resources.filter(r => r.status === 'pending').length}</b>
        </p>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} style={{ width: 100 }} size="small" />
          <Input placeholder="搜索名称" prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 200 }} allowClear size="small" />
        </div>
      </div>
      <Table columns={columns} dataSource={filtered} rowKey="id" loading={loading}
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }} scroll={{ x: 1000 }} />
    </div>
  );
}

// ========== 案例审核 ==========
interface CaseItem {
  id: string;
  title: string;
  summary: string;
  category: CaseCategory;
  team: CaseTeam | '';
  business_scenario: string;
  status: 'pending' | 'published' | 'rejected';
  author_id: string | null;
  author?: { id: string; name: string; avatar: string; department: string };
  developers?: { id: string; name: string; avatar: string; department: string }[];
  created_at: string;
}

function CaseReviewTab() {
  const { message } = App.useApp();
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');

  const fetchCases = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cases/admin');
      if (!res.ok) throw new Error('获取失败');
      const data = await res.json();
      setCases(data.cases ?? []);
    } catch {
      message.error('获取案例列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCases(); }, []);

  const handleReview = async (id: string, status: 'published' | 'rejected') => {
    try {
      const res = await fetch('/api/cases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error('操作失败');
      message.success(status === 'published' ? '已通过' : '已驳回');
      fetchCases();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const filtered = cases.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.title.toLowerCase().includes(q) || c.summary.toLowerCase().includes(q);
    }
    return true;
  });

  const columns: ColumnsType<CaseItem> = [
    { title: '标题', dataIndex: 'title', key: 'title', width: 200, ellipsis: true },
    {
      title: '分类', dataIndex: 'category', key: 'category', width: 140,
      render: (val: string) => <Tag color={(CATEGORY_COLORS as Record<string, string>)[val] ?? 'default'}>{val}</Tag>,
    },
    {
      title: '提报团队', dataIndex: 'team', key: 'team', width: 90,
      render: (val: string) => val || '-',
    },
    {
      title: '开发者', key: 'developers', width: 120,
      render: (_, r) => {
        const devs = r.developers ?? [];
        if (devs.length === 0) return r.author?.name ?? '-';
        return devs.map(d => d.name).join('、');
      },
    },
    {
      title: '提交人', key: 'author', width: 80,
      render: (_, r) => r.author?.name ?? '-',
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (val: string) => {
        const s = STATUS_MAP[val];
        return s ? <Tag color={s.color}>{s.label}</Tag> : val;
      },
    },
    {
      title: '提交时间', dataIndex: 'created_at', key: 'created_at', width: 140,
      render: (val: string) => new Date(val).toLocaleString('zh-CN'),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      defaultSortOrder: 'descend',
    },
    {
      title: '操作', key: 'action', width: 150,
      render: (_, r) => (
        <div className="flex gap-2 items-center">
          {r.status === 'pending' && (
            <>
              <Popconfirm title="确认通过？" onConfirm={() => handleReview(r.id, 'published')}>
                <Button type="primary" size="small" icon={<CheckCircleOutlined />}>通过</Button>
              </Popconfirm>
              <Popconfirm title="确认驳回？" onConfirm={() => handleReview(r.id, 'rejected')}>
                <Button danger size="small" icon={<CloseCircleOutlined />}>驳回</Button>
              </Popconfirm>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          待审核 <b style={{ color: '#d46b08' }}>{cases.filter(c => c.status === 'pending').length}</b>
        </p>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} style={{ width: 100 }} size="small" />
          <Input placeholder="搜索标题" prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 200 }} allowClear size="small" />
        </div>
      </div>
      <Table columns={columns} dataSource={filtered} rowKey="id" loading={loading}
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }} scroll={{ x: 1000 }} />
    </div>
  );
}

// ========== 主页面 ==========
export default function AdminReviewPage() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/');
  }, [authLoading, isAdmin, router]);

  if (authLoading) return <div className="flex justify-center items-center min-h-[60vh]"><Spin size="large" /></div>;
  if (!isAdmin) return null;

  const tabItems = [
    {
      key: 'tools',
      label: <span className="flex items-center gap-1.5"><AppstoreOutlined /> 工具审核</span>,
      children: <ToolReviewTab />,
    },
    {
      key: 'cases',
      label: <span className="flex items-center gap-1.5"><BookOutlined /> 案例审核</span>,
      children: <CaseReviewTab />,
    },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex items-center gap-3 mb-6">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
            style={{ background: 'rgba(120, 80, 160, 0.1)', color: '#7850a0' }}>
            <CheckCircleOutlined />
          </span>
          <h1 className="text-xl font-bold">内容审核</h1>
        </div>

        <Tabs defaultActiveKey="tools" items={tabItems} />
      </div>
    </div>
  );
}
