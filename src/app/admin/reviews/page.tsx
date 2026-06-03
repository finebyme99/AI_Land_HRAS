'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Table, Tag, Select, Input, Button, Spin, Popconfirm, message, Tabs } from 'antd';
import { SearchOutlined, DownloadOutlined, AuditOutlined, TeamOutlined, CheckCircleOutlined, DeleteOutlined, SyncOutlined, BarChartOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import type { CompetitionReview, ReviewScores, ReviewerRole } from '@/types';
import { SCORE_DIMENSIONS, computeWeightedScore } from '@/types';
import type { ColumnsType } from 'antd/es/table';

const reviewFilterOptions = [
  { value: 'all', label: '全部' },
  { value: 'reviewed', label: '已评审' },
  { value: 'pending', label: '待评审' },
];

const statusOptions = [
  { value: '评审中', label: '评审中' },
  { value: '终审通过', label: '终审通过' },
  { value: '待提交人补充方案', label: '待补充' },
  { value: '待提交人调整方案', label: '待调整' },
  { value: '并入其他方案', label: '并入其他' },
];

const ROLE_LABELS: Record<ReviewerRole, string> = { user: '用户评委', business: '业务评委', tech: '技术评委' };
const ROLE_COLORS: Record<ReviewerRole, string> = { user: 'blue', business: 'orange', tech: 'green' };

/* ─── 得分计算：按方案汇总 ─── */
interface SubmissionScore {
  submissionId: string;
  title: string;
  proposalNo: number | null;
  userScore: number | null;
  businessScore: number | null;
  techScore: number | null;
  totalScore: number | null;
  userCount: number;
  businessCount: number;
  techCount: number;
}

function ScoreCalculation({ reviews, submissions, loading }: { reviews: CompetitionReview[]; submissions: { id: string; status?: string }[]; loading: boolean }) {
  const [search, setSearch] = useState('');

  const scoreData = useMemo(() => {
    const map = new Map<string, SubmissionScore>();
    for (const r of reviews) {
      if (r.decision !== 'reviewed' || !r.scores || !r.reviewer_role) continue;
      if (!map.has(r.submission_id)) {
        map.set(r.submission_id, {
          submissionId: r.submission_id,
          title: r.title || '-',
          proposalNo: r.proposal_no ?? null,
          userScore: null, businessScore: null, techScore: null, totalScore: null,
          userCount: 0, businessCount: 0, techCount: 0,
        });
      }
      const s = map.get(r.submission_id)!;
      const total = computeWeightedScore(r.scores, r.reviewer_role);
      if (r.reviewer_role === 'user') {
        s.userScore = (s.userScore ?? 0) + total;
        s.userCount++;
      } else if (r.reviewer_role === 'business') {
        s.businessScore = (s.businessScore ?? 0) + total;
        s.businessCount++;
      } else if (r.reviewer_role === 'tech') {
        s.techScore = (s.techScore ?? 0) + total;
        s.techCount++;
      }
    }
    // 计算均分和加权总分
    for (const s of map.values()) {
      if (s.userCount > 0) s.userScore = Math.round((s.userScore! / s.userCount) * 10) / 10;
      else s.userScore = null;
      if (s.businessCount > 0) s.businessScore = Math.round((s.businessScore! / s.businessCount) * 10) / 10;
      else s.businessScore = null;
      if (s.techCount > 0) s.techScore = Math.round((s.techScore! / s.techCount) * 10) / 10;
      else s.techScore = null;
      // 综合得分 = 用户均分 + 业务均分 + 技术均分（满分50）
      const scores = [s.userScore, s.businessScore, s.techScore].filter((v): v is number => v != null);
      if (scores.length > 0) {
        s.totalScore = Math.round(scores.reduce((a, b) => a + b, 0) * 10) / 10;
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));
  }, [reviews]);

  const filtered = scoreData.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.title.toLowerCase().includes(q) || String(s.proposalNo ?? '').includes(q);
  });

  const columns: ColumnsType<SubmissionScore> = [
    {
      title: '编号',
      dataIndex: 'proposalNo',
      key: 'proposalNo',
      width: 70,
      render: (val: number | null) => val != null ? <span className="font-mono">#{val}</span> : '-',
    },
    {
      title: '方案名称',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: '赛事进展',
      key: 'status',
      width: 100,
      render: (_, r) => {
        const submission = submissions.find((s) => s.id === r.submissionId);
        const status = submission?.status;
        if (!status) return '-';
        const colorMap: Record<string, string> = {
          '评审中': 'blue',
          '终审通过': 'green',
          '待提交人补充方案': 'orange',
          '待提交人调整方案': 'orange',
          '并入其他方案': 'default',
        };
        return <Tag color={colorMap[status] ?? 'default'} className="text-[11px]">{status}</Tag>;
      },
    },
    {
      title: '综合得分',
      key: 'total',
      width: 90,
      align: 'center',
      render: (_, r) => r.totalScore != null
        ? <span className="text-base font-bold" style={{ color: r.totalScore >= 35 ? '#16a34a' : r.totalScore >= 20 ? 'var(--primary)' : '#dc2626' }}>{r.totalScore}</span>
        : <span style={{ color: 'var(--text-muted)' }}>-</span>,
      sorter: (a, b) => (a.totalScore ?? -1) - (b.totalScore ?? -1),
      defaultSortOrder: 'descend',
    },
    {
      title: '用户评委',
      key: 'user',
      width: 110,
      align: 'center',
      render: (_, r) => r.userScore != null
        ? <span className="font-semibold" style={{ color: 'var(--primary)' }}>{r.userScore}</span>
        : <span style={{ color: 'var(--text-muted)' }}>-</span>,
      sorter: (a, b) => (a.userScore ?? -1) - (b.userScore ?? -1),
    },
    {
      title: '业务评委',
      key: 'business',
      width: 110,
      align: 'center',
      render: (_, r) => r.businessScore != null
        ? <span className="font-semibold" style={{ color: '#F27F22' }}>{r.businessScore}</span>
        : <span style={{ color: 'var(--text-muted)' }}>-</span>,
      sorter: (a, b) => (a.businessScore ?? -1) - (b.businessScore ?? -1),
    },
    {
      title: '技术评委',
      key: 'tech',
      width: 110,
      align: 'center',
      render: (_, r) => r.techScore != null
        ? <span className="font-semibold" style={{ color: '#16a34a' }}>{r.techScore}</span>
        : <span style={{ color: 'var(--text-muted)' }}>-</span>,
      sorter: (a, b) => (a.techScore ?? -1) - (b.techScore ?? -1),
    },
    {
      title: '评审人数',
      key: 'counts',
      width: 140,
      render: (_, r) => (
        <div className="flex gap-1 justify-center">
          {r.userCount > 0 && <Tag color="blue" className="text-[11px]">用户×{r.userCount}</Tag>}
          {r.businessCount > 0 && <Tag color="orange" className="text-[11px]">业务×{r.businessCount}</Tag>}
          {r.techCount > 0 && <Tag color="green" className="text-[11px]">技术×{r.techCount}</Tag>}
          {r.userCount === 0 && r.businessCount === 0 && r.techCount === 0 && <span style={{ color: 'var(--text-muted)' }}>暂无</span>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Input
          placeholder="搜索方案名称或编号"
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 240 }}
          allowClear
          size="small"
        />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>共 {filtered.length} 个方案</span>
      </div>
      <Table
        columns={columns}
        dataSource={filtered}
        rowKey="submissionId"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
        scroll={{ x: 700 }}
        size="middle"
      />
    </div>
  );
}

/* ─── 评审明细（原有内容） ─── */
function ReviewDetail({ reviews, submissions, totalSubmissions, loading, search, setSearch, selectedStatuses, setSelectedStatuses, reviewStatusFilter, setReviewStatusFilter, isAdmin, clearingReviewerId, syncing, onClearReviewer, onExport, onSync, fetchReviews }: {
  reviews: CompetitionReview[];
  submissions: { id: string; reviewers?: string[]; status?: string }[];
  totalSubmissions: number;
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  selectedStatuses: string[];
  setSelectedStatuses: (v: string[] | ((prev: string[]) => string[])) => void;
  reviewStatusFilter: string;
  setReviewStatusFilter: (v: string) => void;
  isAdmin: boolean;
  clearingReviewerId: string | null;
  syncing: boolean;
  onClearReviewer: (id: string, name: string) => void;
  onExport: () => void;
  onSync: () => void;
  fetchReviews: () => void;
}) {
  const filtered = reviews.filter((r) => {
    // 赛事进展筛选
    if (selectedStatuses.length > 0) {
      const submission = submissions.find((s) => s.id === r.submission_id);
      if (!submission || !selectedStatuses.includes(submission.status ?? '')) return false;
    }
    // 评审状态筛选
    if (reviewStatusFilter === 'reviewed' && r.decision !== 'reviewed') return false;
    if (reviewStatusFilter === 'pending' && r.decision === 'reviewed') return false;
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
      title: '赛事进展',
      key: 'status',
      width: 100,
      render: (_, record) => {
        const submission = submissions.find((s) => s.id === record.submission_id);
        const status = submission?.status;
        if (!status) return '-';
        const colorMap: Record<string, string> = {
          '评审中': 'blue',
          '终审通过': 'green',
          '待提交人补充方案': 'orange',
          '待提交人调整方案': 'orange',
          '并入其他方案': 'default',
        };
        return <Tag color={colorMap[status] ?? 'default'} className="text-[11px]">{status}</Tag>;
      },
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
      render: (val: ReviewerRole | null) => val ? <Tag color={ROLE_COLORS[val]} className="text-[11px]">{ROLE_LABELS[val]}</Tag> : '-',
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
    <div>
      {/* 评委进度汇总 */}
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
                        <Tag color={ROLE_COLORS[rv.role]} className="text-[11px]">
                          {ROLE_LABELS[rv.role]}
                        </Tag>
                      )}
                      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{rv.department}</span>
                      {isAdmin && (
                        <Popconfirm
                          title={`确认清空 ${rv.name} 的全部评分？`}
                          description="此操作不可撤销，该评委的所有评审记录将被删除。"
                          onConfirm={() => onClearReviewer(reviewerIdMap[rv.name], rv.name)}
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

      {/* 搜索和筛选 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>赛事进展：</span>
          {statusOptions.map((opt) => (
            <Tag
              key={opt.value}
              color={selectedStatuses.includes(opt.value) ? 'blue' : 'default'}
              className="cursor-pointer text-xs"
              onClick={() => {
                setSelectedStatuses((prev) =>
                  prev.includes(opt.value)
                    ? prev.filter((s) => s !== opt.value)
                    : [...prev, opt.value]
                );
              }}
            >
              {opt.label}
            </Tag>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={reviewStatusFilter}
            onChange={setReviewStatusFilter}
            options={reviewFilterOptions}
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
  );
}

/* ─── 主页面 ─── */
export default function AdminReviewsPage() {
  const router = useRouter();
  const { isAdmin, isReviewer, loading: authLoading } = useAuth();
  const [reviews, setReviews] = useState<CompetitionReview[]>([]);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [submissions, setSubmissions] = useState<{ id: string; reviewers?: string[]; status?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reviewStatusFilter, setReviewStatusFilter] = useState('all');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['评审中']);
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

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  if (!isReviewer) return null;

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        {/* 标题栏 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: 'var(--gradient-primary)', color: '#fff', boxShadow: '0 4px 15px rgba(26,58,138,0.25)' }}>
              <AuditOutlined />
            </span>
            <div>
              <h1 className="text-xl font-bold">评审管理</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                共 {reviews.length} 条评审记录 · {totalSubmissions} 个方案
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Tab 切换 */}
        <Tabs
          defaultActiveKey="score"
          items={[
            {
              key: 'score',
              label: <span><BarChartOutlined className="mr-1" />得分计算</span>,
              children: (
                <ScoreCalculation reviews={reviews} submissions={submissions} loading={loading} />
              ),
            },
            {
              key: 'detail',
              label: <span><AuditOutlined className="mr-1" />评审明细</span>,
              children: (
                <ReviewDetail
                  reviews={reviews}
                  submissions={submissions}
                  totalSubmissions={totalSubmissions}
                  loading={loading}
                  search={search}
                  setSearch={setSearch}
                  selectedStatuses={selectedStatuses}
                  setSelectedStatuses={setSelectedStatuses}
                  reviewStatusFilter={reviewStatusFilter}
                  setReviewStatusFilter={setReviewStatusFilter}
                  isAdmin={isAdmin}
                  clearingReviewerId={clearingReviewerId}
                  syncing={syncing}
                  onClearReviewer={handleClearReviewer}
                  onExport={handleExport}
                  onSync={handleSyncToFeishu}
                  fetchReviews={fetchReviews}
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
