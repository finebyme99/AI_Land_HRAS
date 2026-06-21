'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Spin, App, Button, Table, Tag, Tooltip, Input, Select, Switch, Modal,
  Collapse, Space, Empty, Alert, type TableColumnsType,
} from 'antd';
import {
  SyncOutlined, ReloadOutlined, EditOutlined, CheckOutlined, CloseOutlined,
  WarningOutlined, PlusOutlined, EyeOutlined, LinkOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import HighlightSweep from '@/components/HighlightSweep';
import { extractValue, type FieldType } from '@/lib/bitable/field-map';
import { PAGE_LABELS, PAGE_USAGE, type PageKey } from '@/lib/bitable/page-usage';

const BASE_APP = 'LRROwulJciI7JYkIT55cQtdpnze';
const TABLE_ID = 'tbl9WJyxl9bbtYjb';

type DiffStatus = 'synced' | 'new' | 'orphan' | 'inactive';

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
  created_at?: string;
  updated_at?: string;
  status: DiffStatus;
  feishuType?: number;
}

interface ApiResponse {
  base_app: string;
  table_id: string;
  records: FieldRecord[];
  feishuFields: Array<{ field_id: string; field_name: string; type: number; group_id: string; group_name: string }>;
  stats: { total: number; synced: number; new: number; orphan: number; inactive: number };
}

const TYPE_OPTIONS = [
  { value: 'text', label: 'text 文本' },
  { value: 'number', label: 'number 数字' },
  { value: 'select', label: 'select 单选' },
  { value: 'multi_select', label: 'multi_select 多选' },
  { value: 'person', label: 'person 人员' },
  { value: 'formula', label: 'formula 公式' },
  { value: 'date', label: 'date 日期' },
  { value: 'url', label: 'url 链接' },
];

const ROLE_OPTIONS = [
  { value: 'sync', label: 'sync' },
  { value: 'progress', label: 'progress' },
  { value: 'wish-pool', label: 'wish-pool' },
];

function statusBadge(s: DiffStatus): { color: string; label: string; tip: string } {
  switch (s) {
    case 'synced': return { color: 'green', label: '已映射', tip: '飞书有、DB 有、key/type/group 已配' };
    case 'new': return { color: 'orange', label: '新字段', tip: '飞书有但 DB 还没记录 — 点「从飞书刷新」批量入库' };
    case 'orphan': return { color: 'red', label: '已删除', tip: 'DB 有但飞书表里已找不到 — 可手动删除或忽略' };
    case 'inactive': return { color: 'default', label: '已停用', tip: 'is_active=false，不会被任何 API 消费' };
  }
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
  const [previewRecord, setPreviewRecord] = useState<FieldRecord | null>(null);

  useEffect(() => {
    if (!authLoading && !canView) router.replace('/');
  }, [authLoading, canView, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/bitable-field-map?base_app=${BASE_APP}&table_id=${TABLE_ID}`);
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      setData(await res.json());
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

  // 按 group 分组（必须在早返回之前：React Rules of Hooks 要求所有 hook 无条件按相同顺序调用）
  const groupedRecords = useMemo(() => {
    const groups: Record<string, FieldRecord[]> = {};
    for (const r of data?.records ?? []) {
      const g = r.group_name || '未分组';
      if (!groups[g]) groups[g] = [];
      groups[g].push(r);
    }
    // 排序：synced 在前，new 在中间，orphan/inactive 在后
    const ORDER: DiffStatus[] = ['synced', 'new', 'orphan', 'inactive'];
    for (const g of Object.values(groups)) {
      g.sort((a, b) => {
        const oa = ORDER.indexOf(a.status);
        const ob = ORDER.indexOf(b.status);
        if (oa !== ob) return oa - ob;
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
    }
    return groups;
  }, [data?.records]);

  const handleSyncFromFeishu = async () => {
    setSyncing(true);
    message.loading({ content: '从飞书拉取字段…', key: 'sync-feishu', duration: 0 });
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
    return <div className="flex justify-center items-center min-h-[60vh]"><Spin size="large" /></div>;
  }
  if (!canView) return null;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a3a8a, #2d5bc7)', color: '#fff' }}>
            <LinkOutlined />
          </span>
          <HighlightSweep text="飞书字段映射配置" className="text-2xl font-bold" gradient="linear-gradient(135deg, #1a3a8a 0%, #2d5bc7 50%, #F27F22 100%)" />
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
          {canSync && (
            <Button type="primary" icon={<SyncOutlined spin={syncing} />} loading={syncing} onClick={handleSyncFromFeishu}>
              从飞书拉取新字段
            </Button>
          )}
        </Space>
      </div>

      {/* 说明 */}
      <Alert
        type="info"
        showIcon
        className="mb-4"
        message="字段映射说明"
        description={
          <div className="text-xs space-y-1 mt-1">
            <div>• <b>已映射</b>：飞书有、DB 有、已配 key/type/group → 三个 API（sync / progress / wish-pool）都会消费</div>
            <div>• <b>新字段</b>：飞书新增，DB 还没记录 → 点上方「从飞书拉取新字段」批量入库</div>
            <div>• <b>已停用</b>：is_active=false → 任何 API 都不消费（飞书原表不动）</div>
            <div>• <b>已删除</b>：飞书表里已找不到 → 可手动删除映射或忽略</div>
            <div>• 字段名是飞书原始中文名；key 是前端 camelCase key（决定前端代码怎么读这个字段）；type 决定怎么解析飞书返回值</div>
          </div>
        }
      />

      {/* 统计 */}
      {data && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Tag color="green">已映射 {data.stats.synced}</Tag>
          <Tag color="orange">新字段 {data.stats.new}</Tag>
          <Tag color="red">已删除 {data.stats.orphan}</Tag>
          <Tag>已停用 {data.stats.inactive}</Tag>
          <Tag>总计 {data.stats.total}</Tag>
          <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
            表：<code>{BASE_APP.slice(0, 6)}…</code> / <code>{TABLE_ID.slice(0, 6)}…</code>
          </span>
        </div>
      )}

      {/* 字段表 */}
      {data && data.records.length === 0 && (
        <Empty description="该飞书表暂无字段" />
      )}

      {data && Object.entries(groupedRecords).map(([group, records]) => (
        <Collapse
          key={group}
          defaultActiveKey={[group]}
          className="mb-3"
          items={[{
            key: group,
            label: (
              <div className="flex items-center gap-2">
                <span className="font-semibold">{group}</span>
                <Tag>{records.length}</Tag>
                {records.some((r) => r.status === 'new') && <Tag color="orange">有新字段</Tag>}
                {records.some((r) => r.status === 'orphan') && <Tag color="red">有已删除</Tag>}
              </div>
            ),
            children: (
              <FieldTable
                records={records}
                onUpdate={fetchData}
                onPreview={setPreviewRecord}
              />
            ),
          }]}
        />
      ))}

      {/* 字段预览弹窗 */}
      <Modal
        title={previewRecord ? `字段预览：${previewRecord.field_name}` : ''}
        open={!!previewRecord}
        onCancel={() => setPreviewRecord(null)}
        footer={null}
        width={720}
      >
        {previewRecord && <FieldPreview record={previewRecord} />}
      </Modal>
    </div>
  );
}

// ── 字段表 ─────────────────────────────────────
function FieldTable({ records, onUpdate, onPreview }: {
  records: FieldRecord[];
  onUpdate: () => void;
  onPreview: (r: FieldRecord) => void;
}) {
  const { message } = App.useApp();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editType, setEditType] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = (r: FieldRecord) => {
    setEditingId(r.id ?? r.field_name);
    setEditKey(r.key);
    setEditType(r.type);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditKey('');
    setEditType('');
  };

  const saveEdit = async (r: FieldRecord) => {
    if (!r.id) {
      message.error('该字段还没在 DB 中，需要先「从飞书拉取」');
      return;
    }
    if (!editKey) {
      message.error('key 不能为空');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/bitable-field-map/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: editKey, type: editType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '保存失败');
      message.success('已保存');
      setEditingId(null);
      onUpdate();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r: FieldRecord, isActive: boolean) => {
    if (!r.id) {
      message.error('该字段还没在 DB 中，需要先「从飞书拉取」');
      return;
    }
    try {
      const res = await fetch(`/api/admin/bitable-field-map/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '操作失败');
      message.success(isActive ? '已启用' : '已停用');
      onUpdate();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const updateRoles = async (r: FieldRecord, roles: string[]) => {
    if (!r.id) return;
    try {
      const res = await fetch(`/api/admin/bitable-field-map/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || '保存失败');
      }
      onUpdate();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    }
  };

  const deleteRecord = async (r: FieldRecord) => {
    if (!r.id) {
      message.error('该字段还没在 DB 中');
      return;
    }
    Modal.confirm({
      title: `删除映射「${r.field_name}」？`,
      content: '删除后 sync / progress / wish-pool 都不会再消费这个字段。飞书原表不动。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await fetch(`/api/admin/bitable-field-map/${r.id}`, { method: 'DELETE' });
          if (!res.ok) {
            const json = await res.json();
            throw new Error(json.error || '删除失败');
          }
          message.success('已删除');
          onUpdate();
        } catch (e) {
          message.error(e instanceof Error ? e.message : '删除失败');
        }
      },
    });
  };

  const columns: TableColumnsType<FieldRecord> = [
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s: DiffStatus) => {
        const b = statusBadge(s);
        return <Tooltip title={b.tip}><Tag color={b.color}>{b.label}</Tag></Tooltip>;
      },
    },
    {
      title: '飞书字段名',
      dataIndex: 'field_name',
      key: 'field_name',
      width: 180,
      render: (v: string) => (
        <span className="font-medium">{v}</span>
      ),
    },
    // ── 前端页面消费标记 ──
    // 表头/打勾判定都来自 src/lib/bitable/page-usage.ts 的 PAGE_LABELS / PAGE_USAGE
    // 改任一页面用到的字段时同步更新 page-usage.ts
    ...(['choDashboard', 'wishPool', 'wishPoolCard'] as PageKey[]).map((page) => ({
      title: PAGE_LABELS[page],
      key: `page_${page}`,
      width: 110,
      align: 'center' as const,
      render: (r: FieldRecord) => {
        const used = PAGE_USAGE[page].has(r.key);
        if (!used) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
        return (
          <Tooltip title={`${PAGE_LABELS[page]}已消费此字段（key=${r.key}）`}>
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded"
              style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}
            >
              <CheckOutlined style={{ fontSize: 11 }} />
            </span>
          </Tooltip>
        );
      },
    })),
    {
      title: '前端 key',
      dataIndex: 'key',
      key: 'key',
      width: 130,
      render: (v: string, r) => {
        const isEditing = editingId === (r.id ?? r.field_name);
        if (isEditing) {
          return (
            <Input
              size="small"
              value={editKey}
              onChange={(e) => setEditKey(e.target.value)}
              autoFocus
            />
          );
        }
        return <code className="text-xs">{v}</code>;
      },
    },
    {
      title: 'type',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (v: string, r) => {
        const isEditing = editingId === (r.id ?? r.field_name);
        if (isEditing) {
          return (
            <Select
              size="small"
              value={editType}
              onChange={setEditType}
              options={TYPE_OPTIONS}
              style={{ width: '100%' }}
            />
          );
        }
        return <Tag>{v}</Tag>;
      },
    },
    {
      title: 'API',
      dataIndex: 'roles',
      key: 'roles',
      width: 220,
      render: (roles: string[], r) => {
        if (!r.id) {
          return <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>未入库</span>;
        }
        const selected = new Set(roles);
        const toggle = (v: string) => {
          const next = new Set(selected);
          if (next.has(v)) next.delete(v); else next.add(v);
          updateRoles(r, Array.from(next));
        };
        return (
          <div className="flex items-center gap-3 whitespace-nowrap">
            {ROLE_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-1 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={selected.has(opt.value)}
                  onChange={() => toggle(opt.value)}
                  style={{ accentColor: '#f27f22' }}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        );
      },
    },
    {
      title: '启用',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 70,
      render: (v: boolean, r) => (
        <Switch size="small" checked={v} onChange={(c) => toggleActive(r, c)} disabled={!r.id} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, r) => {
        const isEditing = editingId === (r.id ?? r.field_name);
        if (isEditing) {
          return (
            <Space size="small">
              <Button size="small" type="primary" icon={<CheckOutlined />} loading={saving} onClick={() => saveEdit(r)}>
                保存
              </Button>
              <Button size="small" icon={<CloseOutlined />} onClick={cancelEdit}>取消</Button>
            </Space>
          );
        }
        return (
          <Space size="small">
            <Button size="small" icon={<EditOutlined />} onClick={() => startEdit(r)}>编辑</Button>
            <Button size="small" icon={<EyeOutlined />} onClick={() => onPreview(r)}>预览</Button>
            {r.id && (
              <Button size="small" danger type="text" onClick={() => deleteRecord(r)}>删除</Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <style>{`
        .bitable-field-table .ant-table-tbody > tr > td { padding: 6px 10px !important; }
        .bitable-field-table .ant-table-thead > tr > th { padding: 8px 10px !important; }
      `}</style>
      <Table
        className="bitable-field-table"
        rowKey={(r) => r.id ?? r.field_name}
        columns={columns}
        dataSource={records}
        pagination={false}
        size="small"
      />
    </>
  );
}

// ── 字段预览 ─────────────────────────────────────
function FieldPreview({ record }: { record: FieldRecord }) {
  const sampleValue = useMemo(() => {
    switch (record.type) {
      case 'text': return '示例文本';
      case 'number': return 42;
      case 'formula': return 1234.5;
      case 'select': return '选项A';
      case 'multi_select': return ['选项A', '选项B'];
      case 'person': return [{ name: '张三', id: 'ou_xxx' }];
      case 'date': return 1716000000000;
      case 'url': return { link: 'https://example.com', text: '示例链接' };
      default: return null;
    }
  }, [record.type]);

  const mapped = extractValue(sampleValue, record.type as FieldType);

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>飞书原始字段</div>
        <div className="rounded-lg p-3 text-xs font-mono" style={{ background: 'rgba(26,58,138,0.04)', border: '1px solid rgba(26,58,138,0.08)' }}>
          <div>字段名：<b>{record.field_name}</b></div>
          <div>field_id：<code>{record.field_id}</code></div>
          <div>飞书 type 编号：<code>{record.feishuType}</code></div>
          <div>分组：{record.group_name}</div>
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>前端映射</div>
        <div className="rounded-lg p-3 text-xs font-mono" style={{ background: 'rgba(242,127,34,0.04)', border: '1px solid rgba(242,127,34,0.08)' }}>
          <div>key：<b>{record.key}</b></div>
          <div>type：<code>{record.type}</code></div>
          <div>is_active：<code>{String(record.is_active)}</code></div>
          <div>roles：<code>[{record.roles.join(', ')}]</code></div>
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>样例输入 → extractValue 输出</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg p-2 text-xs" style={{ background: 'rgba(0,0,0,0.02)' }}>
            <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>飞书原始值</div>
            <pre className="m-0 whitespace-pre-wrap break-all">{JSON.stringify(sampleValue, null, 2)}</pre>
          </div>
          <div className="rounded-lg p-2 text-xs" style={{ background: 'rgba(22,163,74,0.04)', border: '1px solid rgba(22,163,74,0.1)' }}>
            <div className="text-[10px] mb-1" style={{ color: '#16a34a' }}>映射后值</div>
            <pre className="m-0 whitespace-pre-wrap break-all">{JSON.stringify(mapped, null, 2)}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
