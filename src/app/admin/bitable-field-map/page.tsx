'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App, Alert, Button, Empty, Space, Spin, Table, Tag, Tooltip, type TableColumnsType } from 'antd';
import { LinkOutlined, ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import HighlightSweep from '@/components/HighlightSweep';

const BASE_APP = 'LRROwulJciI7JYkIT55cQtdpnze';
const TABLE_ID = 'tbl9WJyxl9bbtYjb';

type DiffStatus = 'synced' | 'renamed' | 'new' | 'orphan' | 'inactive';

interface FieldRecord {
  id?: string;
  field_id: string | null;
  field_name: string;
  key: string;
  type: string;
  group_name: string;
  is_active: boolean;
  roles: string[];
  sort_order: number;
  status: DiffStatus;
  previous_field_name?: string;
}

interface ApiResponse {
  base_app: string;
  table_id: string;
  assets: FieldAsset[];
  unusedFeishuFields: UnusedFeishuField[];
  assetStats: {
    used: number;
    boundUnshown: number;
    inactive: number;
    renamed: number;
    unusedFeishu: number;
    totalAssets: number;
  };
  stats: {
    total: number;
    synced: number;
    renamed: number;
    new: number;
    orphan: number;
    inactive: number;
  };
}

interface FieldAlias {
  label: string;
  context: string;
}

interface FieldAsset {
  key: string;
  displayName: string;
  aliases: FieldAlias[];
  sourceType: 'feishu_bitable' | 'ai_land_calculated' | 'ai_land_system';
  sourceLabel: string;
  sourceDetail: {
    currentFieldName?: string;
    fieldId?: string | null;
    logic?: string;
    implementation?: string;
  };
  renameInfo: {
    renamed: boolean;
    currentName?: string;
    previousNames: string[];
  };
  status: 'used' | 'bound_unshown' | 'pending' | 'inactive' | 'renamed';
  usage: Array<{ key: string; label: string }>;
  dependencies: Array<{ key: string; label: string }>;
  rows: FieldRecord[];
}

interface UnusedFeishuField {
  id?: string;
  fieldId: string | null;
  fieldName: string;
  groupName: string;
  type: string;
  status: DiffStatus;
  previousFieldName?: string;
}

function assetStatusBadge(status: FieldAsset['status']): { color: string; label: string } {
  switch (status) {
    case 'used':
      return { color: 'green', label: 'AI Land 已使用' };
    case 'bound_unshown':
      return { color: 'blue', label: '已绑定未展示' };
    case 'pending':
      return { color: 'orange', label: '待接入' };
    case 'inactive':
      return { color: 'default', label: '已停用' };
    case 'renamed':
      return { color: 'cyan', label: '飞书已改名' };
  }
}

function unusedStatusBadge(status: DiffStatus): { color: string; label: string; tip: string } {
  switch (status) {
    case 'synced':
      return { color: 'green', label: '已入库', tip: '已在字段映射库中，但当前未被 AI Land 页面使用' };
    case 'renamed':
      return { color: 'cyan', label: '已改名', tip: 'field_id 相同但飞书字段名变化，刷新后会保留历史名称' };
    case 'new':
      return { color: 'orange', label: '新拉取', tip: '飞书多维表已有，但还没有配置成 AI Land 字段' };
    case 'orphan':
      return { color: 'red', label: '飞书已删除', tip: '映射库中还有记录，但飞书表里已经找不到' };
    case 'inactive':
      return { color: 'default', label: '已停用', tip: '字段映射已停用，不会被接口消费' };
  }
}

function sourceColor(sourceType: FieldAsset['sourceType']): string {
  if (sourceType === 'feishu_bitable') return 'blue';
  if (sourceType === 'ai_land_calculated') return 'purple';
  return 'geekblue';
}

function shortId(value: string | null | undefined): string {
  if (!value) return '-';
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

export default function BitableFieldMapPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { hasPermission, loading: authLoading } = useAuth();
  const canView = hasPermission('admin.bitable-field-map');
  const canSync = hasPermission('fieldmap.sync');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!authLoading && !canView) router.replace('/');
  }, [authLoading, canView, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/bitable-field-map?base_app=${BASE_APP}&table_id=${TABLE_ID}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载失败');
      setData(json);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    if (!canView) return undefined;
    const timer = window.setTimeout(() => { void fetchData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [canView, fetchData]);

  const handleSyncFromFeishu = async () => {
    setSyncing(true);
    message.loading({ content: '从飞书拉取字段...', key: 'sync-feishu', duration: 0 });
    try {
      const res = await fetch('/api/admin/bitable-field-map/sync-from-feishu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_app: BASE_APP, table_id: TABLE_ID, fill_known_only: false }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '同步失败');
      message.success({ content: `新增 ${json.inserted}、更新 ${json.updated}、跳过 ${json.skipped}`, key: 'sync-feishu' });
      await fetchData();
    } catch (e) {
      message.error({ content: e instanceof Error ? e.message : '同步失败', key: 'sync-feishu' });
    } finally {
      setSyncing(false);
    }
  };

  if (authLoading || loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Spin size="large" /></div>;
  }
  if (!canView) return null;

  const assets = data?.assets ?? [];
  const unusedFeishuFields = data?.unusedFeishuFields ?? [];

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-4 sm:px-6 sm:py-6">
      <style>{`
        .field-map-table .ant-table { background: transparent; }
        .field-map-table .ant-table-thead > tr > th {
          padding: 10px 12px !important;
          font-size: 13px;
          white-space: nowrap;
        }
        .field-map-table .ant-table-tbody > tr > td {
          padding: 10px 12px !important;
          vertical-align: top;
        }
        .field-map-table .ant-table-cell {
          overflow-wrap: anywhere;
        }
        .field-map-table .ant-tag {
          margin-inline-end: 4px;
          margin-bottom: 4px;
        }
        .field-map-note {
          color: var(--text-muted);
        }
      `}</style>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'linear-gradient(135deg, #1a3a8a, #2d5bc7)', color: '#fff' }}
          >
            <LinkOutlined />
          </span>
          <div className="min-w-0">
            <HighlightSweep
              text="AI Land 字段管理"
              className="text-2xl font-bold leading-tight"
              gradient="linear-gradient(135deg, #1a3a8a 0%, #2d5bc7 50%, #F27F22 100%)"
            />
            <div className="mt-1 text-xs field-map-note">
              以 AI Land 字段为基准管理飞书字段、计算字段和新增未使用字段
            </div>
          </div>
        </div>

        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
          {canSync && (
            <Button type="primary" icon={<SyncOutlined spin={syncing} />} loading={syncing} onClick={handleSyncFromFeishu}>
              从飞书拉取新字段
            </Button>
          )}
        </Space>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tag color="green">已使用 {data?.assetStats.used ?? 0}</Tag>
        <Tag color="blue">已绑定未展示 {data?.assetStats.boundUnshown ?? 0}</Tag>
        <Tag color="orange">飞书新增未使用 {data?.assetStats.unusedFeishu ?? 0}</Tag>
        <Tag color="cyan">飞书已改名 {data?.assetStats.renamed ?? 0}</Tag>
        <Tag>AI Land 字段 {data?.assetStats.totalAssets ?? 0}</Tag>
        <span className="text-xs field-map-note">
          表：<code>{shortId(data?.base_app ?? BASE_APP)}</code> / <code>{shortId(data?.table_id ?? TABLE_ID)}</code>
        </span>
      </div>

      <Alert
        type="info"
        showIcon
        className="mb-4"
        title="当前页面只展示业务口径字段资产。飞书字段改名会按 field_id 识别；新拉取但 AI Land 没用的字段会出现在下方字段池。"
      />

      <section className="glass mb-5 rounded-xl border border-white/60 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="m-0 text-base font-semibold">AI Land 字段列表</h2>
            <div className="mt-1 text-xs field-map-note">同一字段在不同页面的名称会合并显示，悬停标签可看使用页面。</div>
          </div>
          <Tag color="purple">{assets.length}</Tag>
        </div>

        {assets.length > 0 ? (
          <AssetTable assets={assets} />
        ) : (
          <Empty description="暂无 AI Land 字段" />
        )}
      </section>

      <section className="glass rounded-xl border border-white/60 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="m-0 text-base font-semibold">飞书新增未使用字段</h2>
            <div className="mt-1 text-xs field-map-note">多维表已拉到，但 AI Land 当前没有消费；后续可从这里判断是否接入。</div>
          </div>
          <Tag color={unusedFeishuFields.length > 0 ? 'orange' : 'default'}>{unusedFeishuFields.length}</Tag>
        </div>

        {unusedFeishuFields.length > 0 ? (
          <UnusedFeishuTable rows={unusedFeishuFields} />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无飞书新增未使用字段" />
        )}
      </section>
    </main>
  );
}

function AssetTable({ assets }: { assets: FieldAsset[] }) {
  const columns: TableColumnsType<FieldAsset> = [
    {
      title: 'AI Land 字段',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 280,
      fixed: 'left',
      render: (value: string, record) => (
        <div className="min-w-0">
          <div className="font-semibold leading-snug">{value}</div>
          <code className="text-[11px]">{record.key}</code>
          {record.aliases.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {record.aliases.map((alias) => (
                <Tooltip key={`${record.key}:${alias.context}:${alias.label}`} title={alias.context}>
                  <Tag className="!m-0" color={alias.context.includes('历史') ? 'default' : 'processing'}>
                    {alias.label}
                  </Tag>
                </Tooltip>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '使用位置',
      dataIndex: 'usage',
      key: 'usage',
      width: 170,
      render: (usage: FieldAsset['usage']) => (
        usage.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {usage.map((item) => <Tag key={item.key} color="green">{item.label}</Tag>)}
          </div>
        ) : (
          <span className="field-map-note">未展示</span>
        )
      ),
    },
    {
      title: '数据源 / 处理逻辑',
      dataIndex: 'sourceDetail',
      key: 'sourceDetail',
      width: 310,
      render: (_, record) => {
        if (record.sourceType === 'feishu_bitable') {
          return (
            <div>
              <Tag color={sourceColor(record.sourceType)}>{record.sourceLabel}</Tag>
              <div className="mt-1 font-medium leading-snug">{record.sourceDetail.currentFieldName || '-'}</div>
              <Tooltip title={record.sourceDetail.fieldId || '无 field_id'}>
                <code className="text-[11px]">{shortId(record.sourceDetail.fieldId)}</code>
              </Tooltip>
            </div>
          );
        }

        return (
          <div>
            <Tag color={sourceColor(record.sourceType)}>{record.sourceLabel}</Tag>
            <div className="mt-1 leading-snug">{record.sourceDetail.logic || '-'}</div>
            {record.sourceDetail.implementation && (
              <Tooltip title={record.sourceDetail.implementation}>
                <code className="text-[11px]">{record.sourceDetail.implementation}</code>
              </Tooltip>
            )}
          </div>
        );
      },
    },
    {
      title: '字段状态',
      dataIndex: 'status',
      key: 'status',
      width: 165,
      render: (status: FieldAsset['status'], record) => {
        const badge = assetStatusBadge(status);
        return (
          <div className="flex flex-col items-start gap-1">
            <Tag color={badge.color}>{badge.label}</Tag>
            {record.renameInfo.renamed && (
              <Tooltip title={`历史名称：${record.renameInfo.previousNames.join(' / ') || '-'}`}>
                <Tag color="cyan">有改名记录</Tag>
              </Tooltip>
            )}
            {record.rows.some((row) => row.status === 'orphan') && <Tag color="red">飞书已删除</Tag>}
          </div>
        );
      },
    },
    {
      title: '依赖字段 / 说明',
      dataIndex: 'dependencies',
      key: 'dependencies',
      width: 240,
      render: (dependencies: FieldAsset['dependencies'], record) => {
        if (dependencies.length > 0) {
          return (
            <div className="flex flex-wrap gap-1">
              {dependencies.map((item) => (
                <Tooltip key={item.key} title={item.key}>
                  <Tag>{item.label}</Tag>
                </Tooltip>
              ))}
            </div>
          );
        }

        if (record.sourceType === 'feishu_bitable') {
          return <span className="field-map-note">直接来自飞书字段</span>;
        }
        return <span className="field-map-note">无上游依赖</span>;
      },
    },
  ];

  return (
    <Table
      className="field-map-table"
      rowKey={(record) => record.key}
      columns={columns}
      dataSource={assets}
      pagination={{ pageSize: 20, showSizeChanger: false, hideOnSinglePage: true }}
      scroll={{ x: 1165 }}
      size="small"
      tableLayout="fixed"
    />
  );
}

function UnusedFeishuTable({ rows }: { rows: UnusedFeishuField[] }) {
  const columns: TableColumnsType<UnusedFeishuField> = [
    {
      title: '飞书字段',
      dataIndex: 'fieldName',
      key: 'fieldName',
      width: 300,
      render: (value: string, record) => (
        <div>
          <div className="font-medium leading-snug">{value}</div>
          <Tooltip title={record.fieldId || '无 field_id'}>
            <code className="text-[11px]">{shortId(record.fieldId)}</code>
          </Tooltip>
          {record.previousFieldName && (
            <div className="text-xs field-map-note">原名：{record.previousFieldName}</div>
          )}
        </div>
      ),
    },
    {
      title: '分组 / 类型',
      dataIndex: 'groupName',
      key: 'groupName',
      width: 180,
      render: (value: string, record) => (
        <div>
          <div>{value || '未分组'}</div>
          <Tag>{record.type}</Tag>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: DiffStatus) => {
        const badge = unusedStatusBadge(status);
        return (
          <Tooltip title={badge.tip}>
            <Tag color={badge.color}>{badge.label}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '下一步',
      key: 'next',
      render: () => <Tag color="orange">待判断是否接入 AI Land</Tag>,
    },
  ];

  return (
    <Table
      className="field-map-table"
      rowKey={(record) => record.id ?? record.fieldId ?? record.fieldName}
      columns={columns}
      dataSource={rows}
      pagination={{ pageSize: 12, showSizeChanger: false, hideOnSinglePage: true }}
      scroll={{ x: 780 }}
      size="small"
      tableLayout="fixed"
    />
  );
}
