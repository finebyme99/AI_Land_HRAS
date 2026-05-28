'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Table, Tag, Select, Input, Button, Spin, message } from 'antd';
import { SearchOutlined, DownloadOutlined, AuditOutlined, TeamOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
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
  const [totalSubmissions, setTotalSubmissions] = useState(0);
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
      const [reviewsRes, syncRes] = await Promise.all([
        fetch('/api/competitions/reviews'),
        fetch('/api/competitions/sync?period=2605'),
      ]);
      if (!reviewsRes.ok) throw new Error('获取失败');
      const reviewsData = await reviewsRes.json();
      setReviews(reviewsData.reviews ?? []);
      const syncData = await syncRes.json();
      setTotalSubmissions(syncData.total ?? 0);
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

        {/* 评委评审进度汇总 */}
        {!loading && reviews.length > 0 && (() => {
          const reviewedSubmissionIds = new Set(reviews.map((r) => r.submission_id));
          const byReviewer: Record<string, { name: string; department: string; approved: number; rejected: number }> = {};
          for (const r of reviews) {
            const key = r.reviewer_id;
            if (!byReviewer[key]) {
              byReviewer[key] = {
                name: r.reviewer?.name || r.reviewer_id,
                department: r.reviewer?.department || '-',
                approved: 0,
                rejected: 0,
              };
            }
            if (r.decision === 'approved') byReviewer[key].approved++;
            else byReviewer[key].rejected++;
          }
          const reviewerList = Object.values(byReviewer);
          return (
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>方案总数 <b style={{ color: 'var(--foreground)' }}>{totalSubmissions}</b></span>
                <span>已评审 <b style={{ color: 'var(--foreground)' }}>{reviewedSubmissionIds.size}</b></span>
                <span>未评审 <b style={{ color: totalSubmissions - reviewedSubmissionIds.size > 0 ? '#b3540e' : 'var(--foreground)' }}>
                  {totalSubmissions - reviewedSubmissionIds.size}
                </b></span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {reviewerList.map((rv) => {
                  const total = rv.approved + rv.rejected;
                  const pct = totalSubmissions > 0 ? Math.round((total / totalSubmissions) * 100) : 0;
                  return (
                    <div key={rv.name} className="rounded-xl p-3" style={{ background: 'rgba(26,58,138,0.03)', border: '1px solid rgba(26,58,138,0.06)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <TeamOutlined style={{ color: 'var(--primary)' }} />
                        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{rv.name}</span>
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{rv.department}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span style={{ color: '#16a34a' }}><CheckCircleOutlined /> {rv.approved}</span>
                        <span style={{ color: '#dc2626' }}><CloseCircleOutlined /> {rv.rejected}</span>
                        <span style={{ color: 'var(--text-muted)' }}>共 {total} 条</span>
                        <span className="ml-auto text-[11px]" style={{ color: pct >= 100 ? '#16a34a' : '#b3540e' }}>
                          {pct}% 完成
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

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
