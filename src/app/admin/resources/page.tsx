'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Table, Tag, Button, Input, Select, Spin, Popconfirm, Modal, Form, App } from 'antd';
import { SearchOutlined, CheckCircleOutlined, CloseCircleOutlined, AppstoreOutlined, LinkOutlined, EditOutlined, CameraOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import { RESOURCE_CATEGORY_COLORS } from '@/lib/constants';
import { RESOURCE_CATEGORIES } from '@/types';
import type { ColumnsType } from 'antd/es/table';

interface ResourceItem {
  id: string;
  name: string;
  description: string;
  content: string;
  category: string;
  scenarios: string[];
  official_url: string;
  logo: string;
  status: 'pending' | 'published' | 'rejected';
  author_id: string | null;
  created_at: string;
}

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

const ALL_CATEGORIES = RESOURCE_CATEGORIES;

export default function AdminResourcesPage() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();
  const { message } = App.useApp();
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState<ResourceItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/');
  }, [authLoading, isAdmin, router]);

  const fetchResources = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/resources/admin');
      if (!res.ok) throw new Error('获取失败');
      const data = await res.json();
      setResources(data.resources ?? []);

      // 批量获取作者名称
      const authorIds = [...new Set(data.resources.map((r: ResourceItem) => r.author_id).filter(Boolean))];
      if (authorIds.length > 0) {
        const usersRes = await fetch(`/api/admin/users`);
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

  useEffect(() => { if (isAdmin) fetchResources(); }, [isAdmin]);

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

  const handleLogoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      message.error('仅支持图片格式');
      return;
    }
    if (file.size > 500 * 1024) {
      message.error('图片大小不能超过 500KB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/apps/logo', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '上传失败');
      setLogoUrl(data.url);
      message.success('图片已上传');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openEdit = (record: ResourceItem) => {
    setEditing(record);
    setLogoUrl(record.logo || null);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      content: record.content,
      category: record.category,
      scenarios: record.scenarios,
      official_url: record.official_url,
    });
    setEditModalOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const values = await form.validateFields();
      const res = await fetch('/api/resources/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, ...values, logo: logoUrl || '' }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '保存失败');
      }
      message.success('已保存');
      setEditModalOpen(false);
      setEditing(null);
      fetchResources();
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    } finally {
      setSaving(false);
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

  if (authLoading) return <div className="flex justify-center items-center min-h-[60vh]"><Spin size="large" /></div>;
  if (!isAdmin) return null;

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
      title: '操作', key: 'action', width: 180,
      render: (_, r) => (
        <div className="flex gap-2 items-center">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
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
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: 'rgba(120, 80, 160, 0.1)', color: '#7850a0' }}>
              <AppstoreOutlined />
            </span>
            <div>
              <h1 className="text-xl font-bold">工具审核</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                待审核 <b style={{ color: '#d46b08' }}>{resources.filter(r => r.status === 'pending').length}</b>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} style={{ width: 100 }} size="small" />
            <Input placeholder="搜索名称" prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 200 }} allowClear size="small" />
          </div>
        </div>

        <Table columns={columns} dataSource={filtered} rowKey="id" loading={loading}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }} scroll={{ x: 1000 }} />
      </div>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑工具"
        open={editModalOpen}
        onCancel={() => { setEditModalOpen(false); setEditing(null); }}
        onOk={handleSave}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical" className="mt-4">
          {/* 工具图片 */}
          <Form.Item label="工具图片">
            <div className="flex items-center gap-4">
              <div className="relative cursor-pointer group" onClick={handleLogoClick}>
                <div className="w-20 h-20 rounded-xl flex items-center justify-center overflow-hidden"
                  style={{ border: '2px dashed var(--border-light)', background: 'rgba(255,255,255,0.3)' }}>
                  {logoUrl ? (
                    <img src={logoUrl} alt="工具图片" className="w-full h-full object-cover" />
                  ) : (
                    <AppstoreOutlined style={{ fontSize: 24, color: 'var(--text-muted)' }} />
                  )}
                </div>
                <div className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.45)' }}>
                  <CameraOutlined style={{ color: '#fff', fontSize: 18 }} />
                </div>
                {uploading && (
                  <div className="absolute inset-0 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.45)' }}>
                    <Spin size="small" />
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*,.svg" className="hidden" onChange={handleFileChange} />
              <div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>点击更换图片</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>支持 JPG/PNG/SVG，不超过 500KB</p>
              </div>
            </div>
          </Form.Item>

          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input maxLength={80} showCount />
          </Form.Item>
          <Form.Item name="description" label="简介" rules={[{ required: true, message: '请输入简介' }]}>
            <Input.TextArea rows={2} maxLength={200} showCount />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select options={ALL_CATEGORIES.map(c => ({ label: c, value: c }))} />
          </Form.Item>
          <Form.Item name="scenarios" label="适用场景">
            <Select mode="multiple" placeholder="选择适用场景" options={[
              { label: '编程', value: '编程' },
              { label: '设计', value: '设计' },
              { label: '写作', value: '写作' },
              { label: '数据分析', value: '数据分析' },
              { label: '咨询搜集', value: '咨询搜集' },
              { label: '日常提效', value: '日常提效' },
            ]} />
          </Form.Item>
          <Form.Item name="official_url" label="官网 / 链接">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="content" label="详细说明">
            <Input.TextArea rows={4} placeholder="操作步骤、使用技巧等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
