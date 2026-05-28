'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Table, Tag, Select, Input, Button, Spin, message } from 'antd';
import { SearchOutlined, DownloadOutlined, AuditOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import type { CompetitionReview } from '@/types';
import type { ColumnsType } from 'antd/es/table';

const decisionOptions = [
  { value: 'all', label: '全部' },
  { value: 'approved', label: '通过' },
  { value: 'rejected', label: '驳回' },
];

export default function AdminReviewsPage() {
  const router = useRouter();
  const { isAdmin, isReviewer, loading: authLoading } = useAuth();
  const [reviews, setReviews] = useState<CompetitionReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('all');

  useEffect(() => {
    if (!authLoading && !isReviewer) {
      router.replace('/');
    }
  }, [authLoading, isReviewer, router]);

  useEffect(() => {
    if (isReviewer) {
      fetchReviews();
    }
  }, [isReviewer]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/competitions/reviews');
      if (!res.ok) throw new Error('获取失败');
      const data = await res.json();
      setReviews(data.reviews ?? []);
    } catch {
      message.error('获取评审记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch('/api/competitions/reviews/export');
      if (!res.ok) throw new Error('导出失败');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `competition_reviews_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error('导出失败');
    }
  };

  const filtered = reviews.filter((r) => {
    if (decisionFilter !== 'all' && r.decision !== decisionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.submission_id.toLowerCase().includes(q) ||
        r.title?.toLowerCase().includes(q) ||
        String(r.proposal_no ?? '').includes(q) ||
        r.reviewer?.name?.toLowerCase().includes(q) ||
        r.reviewer?.department?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  if (!isReviewer) return null;

  const columns: ColumnsType<CompetitionReview> = [
    {
      title: '编号',
      dataIndex: 'proposal_no',
      key: 'proposal_no',
      width: 70,
      render: (val: number | null) => val != null ? `#${val}` : '-',
    },
    {
      title: '方案名称',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: '评审人',
      key: 'reviewer',
      width: 120,
      render: (_, record) => record.reviewer?.name || record.reviewer_id,
    },
    {
      title: '部门',
      key: 'department',
      width: 150,
      render: (_, record) => record.reviewer?.department || '-',
    },
    {
      title: '评审结果',
      dataIndex: 'decision',
      key: 'decision',
      width: 100,
      render: (val: string) => (
        <Tag color={val === 'approved' ? 'green' : 'red'}>
          {val === 'approved' ? '通过' : '驳回'}
        </Tag>
      ),
    },
    {
      title: '标杆',
      dataIndex: 'is_benchmark',
      key: 'is_benchmark',
      width: 70,
      render: (val: boolean) => val ? <Tag color="gold">标杆</Tag> : '-',
    },
    {
      title: '评审理由',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (val: string) => val || '-',
    },
    {
      title: '评审时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (val: string) => new Date(val).toLocaleString('zh-CN'),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      defaultSortOrder: 'descend',
    },
  ];

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: 'var(--gradient-primary)', color: '#fff', boxShadow: '0 4px 15px rgba(26,58,138,0.25)' }}>
              <AuditOutlined />
            </span>
            <div>
              <h1 className="text-xl font-bold">评审管理</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                共 {reviews.length} 条评审记录
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={decisionFilter}
              onChange={setDecisionFilter}
              options={decisionOptions}
              style={{ width: 100 }}
              size="small"
            />
            <Input
              placeholder="搜索方案ID或评审人"
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 200 }}
              allowClear
              size="small"
            />
            {isAdmin && (
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExport}
                size="small"
                style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}
              >
                导出 CSV
              </Button>
            )}
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 800 }}
        />
      </div>
    </div>
  );
}
