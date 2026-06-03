'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Table, Tag, Select, Input, Button, Spin, Popconfirm, message } from 'antd';
import { SearchOutlined, DownloadOutlined, AuditOutlined, TeamOutlined, CheckCircleOutlined, ClockCircleOutlined, DeleteOutlined, SyncOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import type { CompetitionReview, ReviewScores, ReviewerRole } from '@/types';
import { SCORE_DIMENSIONS, computeWeightedScore } from '@/types';
import type { ColumnsType } from 'antd/es/table';

const filterOptions = [
  { value: 'all', label: '全部' },
  { value: 'reviewed', label: '已评审' },
  { value: 'pending', label: '待评审' },
];

const ROLE_LABELS: Record<ReviewerRole, string> = { user: '用户评委', business: '业务评委', tech: '技术评委' };

export default function AdminReviewsPage() {
  const router = useRouter();
  const { isAdmin, isReviewer, loading: authLoading } = useAuth();
  const [reviews, setReviews] = useState<CompetitionReview[]>([]);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [submissions, setSubmissions] = useState<{ id: string; reviewers?: string[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clearingReviewerId, setClearingReviewerId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

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
      setSubmissions(syncData.items ?? []);
    } catch {
      message.error('获取评审记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClearReviewer = async (reviewerId: string, reviewerName: string) => {
    setClearingReviewerId(reviewerId);
    try {
      const res = await fetch(`/api/competitions/reviews?reviewer_id=${reviewerId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '清空失败');
      message.success(`已清空 ${reviewerName} 的 ${data.deleted} 条评审记录`);
      fetchReviews();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '清空失败');
    } finally {
      setClearingReviewerId(null);
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

  const handleSyncToFeishu = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/reviews/sync-progress', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '同步失败');
      message.success(`同步完成：新增 ${data.created} 条，更新 ${data.updated} 条`);
      if (data.tableUrl) window.open(data.tableUrl, '_blank');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '同步失败');
    } finally {
      setSyncing(false);
    }
  };

  const filtered = reviews.filter((r) => {
    if (statusFilter === 'reviewed' && r.decision !== 'reviewed') return false;
    if (statusFilter === 'pending' && r.decision === 'reviewed') return false;
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
      width: 180,
      ellipsis: true,
    },
    {
      title: '评审人',
      key: 'reviewer',
      width: 100,
      render: (_, record) => record.reviewer?.name || record.reviewer_id,
    },
    {
      title: '角色',
      dataIndex: 'reviewer_role',
      key: 'reviewer_role',
      width: 90,
      render: (val: ReviewerRole | null) => val ? ROLE_LABELS[val] : '-',
    },
    {
      title: '总分',
      key: 'total',
      width: 80,
      render: (_, record) => {
        if (record.decision !== 'reviewed' || !record.scores || !record.reviewer_role) return '-';
        const total = computeWeightedScore(record.scores, record.reviewer_role);
        return <span className="font-semibold" style={{ color: total >= 35 ? '#16a34a' : total >= 20 ? 'var(--primary)' : '#dc2626' }}>{total.toFixed(1)}</span>;
      },
      sorter: (a, b) => {
        const ta = a.decision === 'reviewed' && a.scores && a.reviewer_role ? computeWeightedScore(a.scores, a.reviewer_role) : 0;
        const tb = b.decision === 'reviewed' && b.scores && b.reviewer_role ? computeWeightedScore(b.scores, b.reviewer_role) : 0;
        return ta - tb;
      },
    },
    ...Object.values(SCORE_DIMENSIONS).flat().map((dim) => ({
      title: dim.label,
      key: dim.key,
      width: 80,
      render: (_: unknown, record: CompetitionReview) => {
        const val = record.scores?.[dim.key];
        return val != null ? <span style={{ color: val >= 4 ? '#16a34a' : val <= 2 ? '#dc2626' : 'inherit' }}>{val}</span> : '-';
      },
    })),
    {
      title: '评语',
      dataIndex: 'reason',
      key: 'reason',
      width: 150,
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
              value={statusFilter}
              onChange={setStatusFilter}
              options={filterOptions}
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
              <>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleExport}
                  size="small"
                  style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}
                >
                  导出 CSV
                </Button>
                <Button
                  icon={<SyncOutlined spin={syncing} />}
                  onClick={handleSyncToFeishu}
                  loading={syncing}
                  size="small"
                  type="primary"
                >
                  同步到飞书
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 评委评审进度汇总 */}
        {!loading && reviews.length > 0 && (() => {
          const reviewedSubmissionIds = new Set(reviews.filter((r) => r.decision === 'reviewed').map((r) => r.submission_id));
          const byReviewer: Record<string, { name: string; department: string; role: ReviewerRole | null; reviewed: number; avgScore: number; scoreCount: number }> = {};
          for (const r of reviews) {
            const key = r.reviewer_id;
            if (!byReviewer[key]) {
              byReviewer[key] = {
                name: r.reviewer?.name || r.reviewer_id,
                department: r.reviewer?.department || '-',
                role: r.reviewer_role ?? null,
                reviewed: 0,
                avgScore: 0,
                scoreCount: 0,
              };
            }
            if (r.decision === 'reviewed') {
              byReviewer[key].reviewed++;
              if (r.scores && r.reviewer_role) {
                byReviewer[key].avgScore += computeWeightedScore(r.scores, r.reviewer_role);
                byReviewer[key].scoreCount++;
              }
            }
          }
          const reviewerIdMap: Record<string, string> = {};
          for (const r of reviews) {
            reviewerIdMap[r.reviewer?.name || r.reviewer_id] = r.reviewer_id;
          }
          const reviewerList = Object.values(byReviewer);
          return (
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>方案总数 <b style={{ color: 'var(--foreground)' }}>{totalSubmissions}</b></span>
                <span>已评审 <b style={{ color: '#16a34a' }}>{reviewedSubmissionIds.size}</b></span>
                <span>未评审 <b style={{ color: totalSubmissions - reviewedSubmissionIds.size > 0 ? '#b3540e' : 'var(--foreground)' }}>
                  {totalSubmissions - reviewedSubmissionIds.size}
                </b></span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {reviewerList.map((rv) => {
                  // 用户评委：按 reviewers 字段模糊匹配计算分配方案数；业务/技术评委：全部方案
                  const denominator = rv.role === 'user'
                    ? submissions.filter((s) => s.reviewers?.some((r: string) => r.includes(rv.name) || rv.name.includes(r))).length
                    : totalSubmissions;
                  const pct = denominator > 0 ? Math.min(Math.round((rv.reviewed / denominator) * 100), 100) : 0;
                  const avg = rv.scoreCount > 0 ? (rv.avgScore / rv.scoreCount).toFixed(1) : '-';
                  return (
                    <div key={rv.name} className="rounded-xl p-3" style={{ background: 'rgba(26,58,138,0.03)', border: '1px solid rgba(26,58,138,0.06)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <TeamOutlined style={{ color: 'var(--primary)' }} />
                        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{rv.name}</span>
                        {rv.role && (
                          <Tag color={rv.role === 'user' ? 'blue' : rv.role === 'business' ? 'orange' : 'green'} className="text-[11px]">
                            {ROLE_LABELS[rv.role]}
                          </Tag>
                        )}
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{rv.department}</span>
                        {isAdmin && (
                          <Popconfirm
                            title={`确认清空 ${rv.name} 的全部评分？`}
                            description="此操作不可撤销，该评委的所有评审记录将被删除。"
                            onConfirm={() => handleClearReviewer(reviewerIdMap[rv.name], rv.name)}
                            okText="确认清空"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                          >
                            <Button
                              type="text"
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              loading={clearingReviewerId === reviewerIdMap[rv.name]}
                              className="ml-auto"
                            >
                              清空评分
                            </Button>
                          </Popconfirm>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span style={{ color: '#16a34a' }}><CheckCircleOutlined /> {rv.reviewed}</span>
                        <span style={{ color: 'var(--text-muted)' }}>均分 {avg}</span>
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
