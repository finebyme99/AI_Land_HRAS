'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App, Card, Spin, Table, Tag, Typography, type TableColumnsType } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import type { OperationLogRow, OperationLogSource, OperationLogStatus } from '@/lib/operation-log-row';

const ACTION_LABELS: Record<string, string> = {
  competition_sync: '场景数据同步',
};

const SOURCE_LABELS: Record<OperationLogSource, string> = {
  admin: '后台手动',
  cron: '定时任务',
};

const STATUS_LABELS: Record<OperationLogStatus, string> = {
  success: '成功',
  failed: '失败',
};

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function resultSummary(result: Record<string, unknown>): string {
  const error = result.error;
  if (typeof error === 'string' && error) return error;

  const parts = [
    ['拉取', result.fetched],
    ['成功', result.succeeded],
    ['变化', result.changed],
    ['跳过', result.skipped],
    ['清重', result.removedDuplicates],
  ]
    .filter(([, value]) => typeof value === 'number')
    .map(([label, value]) => `${label} ${value}`);

  return parts.length ? parts.join(' / ') : JSON.stringify(result);
}

export default function OperationLogsPage() {
  const router = useRouter();
  const { hasPermission, loading: authLoading } = useAuth();
  const canView = hasPermission('admin.operation-logs');
  const { message } = App.useApp();
  const [logs, setLogs] = useState<OperationLogRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/operation-logs');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '获取操作日志失败');
      setLogs(data.logs ?? []);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '获取操作日志失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    if (!authLoading && !canView) router.replace('/');
  }, [authLoading, canView, router]);

  useEffect(() => {
    if (!canView) return undefined;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [canView, load]);

  if (authLoading) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Spin size="large" /></div>;
  }
  if (!canView) return null;

  const columns: TableColumnsType<OperationLogRow> = [
    {
      title: '时间',
      dataIndex: 'request_time',
      width: 180,
      render: (value: string) => formatTime(value),
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 140,
      render: (value: string) => ACTION_LABELS[value] ?? value,
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 110,
      render: (value: OperationLogSource) => (
        <Tag color={value === 'admin' ? 'blue' : 'purple'}>{SOURCE_LABELS[value]}</Tag>
      ),
    },
    {
      title: '操作者',
      dataIndex: 'operator_name',
      width: 150,
      render: (value: string | null, row) => value || row.operator_user_id || '系统',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (value: OperationLogStatus) => (
        <Tag color={value === 'success' ? 'green' : 'red'}>{STATUS_LABELS[value]}</Tag>
      ),
    },
    {
      title: '结果',
      dataIndex: 'result',
      render: (value: Record<string, unknown>) => (
        <Typography.Text className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {resultSummary(value)}
        </Typography.Text>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">操作日志</h1>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
          style={{ background: 'white', color: '#1a3a8a', border: '1px solid #d1d5db' }}
        >
          <SyncOutlined spin={loading} /> 刷新
        </button>
      </div>

      <Card className="glass" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
        <Table
          dataSource={logs}
          rowKey="id"
          loading={loading}
          columns={columns}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  );
}
