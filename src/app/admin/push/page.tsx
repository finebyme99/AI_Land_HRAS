'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Spin, Input, Tag, Button, message, Tabs, Checkbox, Empty } from 'antd';
import { SendOutlined, SearchOutlined, WechatOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';

/* ─── 类型 ─── */
interface Chat {
  chat_id: string;
  name: string;
  chat_type: string;
}

interface ContentItem {
  id: string;
  title: string;
  category?: string;
  description?: string;
  instructor?: string;
  difficulty?: string;
  type: 'course' | 'resource' | 'case' | 'submission';
}

interface PushLog {
  id: string;
  content_type: string;
  content_title: string;
  target_chat_name: string;
  status: string;
  created_at: string;
}

/* ─── 内容类型配置 ─── */
const CONTENT_TABS = [
  { key: 'course', label: '🎓 公开课', type: 'course' as const },
  { key: 'resource', label: '🛠️ 工具', type: 'resource' as const },
  { key: 'case', label: '📚 案例', type: 'case' as const },
  { key: 'submission', label: '📋 大赛方案', type: 'submission' as const },
];

const TYPE_LABELS: Record<string, string> = {
  course: '公开课',
  resource: '工具',
  case: '案例',
  submission: '大赛方案',
};

export default function AdminPushPage() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();

  // 群聊
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatSearch, setChatSearch] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('push_chat_id') || '' : ''
  );
  const [chatsLoading, setChatsLoading] = useState(true);

  // 内容
  const [activeTab, setActiveTab] = useState('course');
  const [contentMap, setContentMap] = useState<Record<string, ContentItem[]>>({});
  const [contentLoading, setContentLoading] = useState(false);

  // 选中项
  const [selected, setSelected] = useState<Map<string, ContentItem>>(new Map());

  // 推送
  const [pushing, setPushing] = useState(false);

  // 推送日志
  const [logs, setLogs] = useState<PushLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  /* ─── 权限 ─── */
  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/');
  }, [authLoading, isAdmin, router]);

  /* ─── 加载群列表 ─── */
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setChatsLoading(true);
      try {
        const res = await fetch('/api/admin/push/chats');
        const data = await res.json();
        setChats(data.chats ?? []);
      } catch {
        message.error('获取群列表失败');
      } finally {
        setChatsLoading(false);
      }
    })();
  }, [isAdmin]);

  /* ─── 加载内容列表 ─── */
  useEffect(() => {
    if (!isAdmin) return;
    loadContent(activeTab);
  }, [isAdmin, activeTab]);

  const loadContent = async (type: string) => {
    if (contentMap[type]) return; // 已加载
    setContentLoading(true);
    try {
      let items: ContentItem[] = [];
      if (type === 'course') {
        const res = await fetch('/api/courses');
        const data = await res.json();
        items = (data.courses ?? data.items ?? []).map((c: Record<string, unknown>) => ({
          id: c.id, title: c.title, category: c.category, description: c.description,
          instructor: c.instructor, difficulty: c.difficulty, type: 'course' as const,
        }));
      } else if (type === 'resource') {
        const res = await fetch('/api/resources');
        const data = await res.json();
        items = (data.items ?? []).map((r: Record<string, unknown>) => ({
          id: r.id, title: r.name ?? r.title, category: r.category, description: r.description, type: 'resource' as const,
        }));
      } else if (type === 'case') {
        const res = await fetch('/api/cases');
        const data = await res.json();
        items = (data.items ?? []).map((c: Record<string, unknown>) => ({
          id: c.id, title: c.title, category: c.category, description: c.summary, type: 'case' as const,
        }));
      } else if (type === 'submission') {
        const res = await fetch('/api/competitions/sync?period=2605');
        const data = await res.json();
        items = (data.items ?? []).map((s: Record<string, unknown>) => ({
          id: s.id, title: s.title, category: s.track, description: s.afterProcess, type: 'submission' as const,
        }));
      }
      setContentMap((prev) => ({ ...prev, [type]: items }));
    } catch {
      message.error('获取内容列表失败');
    } finally {
      setContentLoading(false);
    }
  };

  /* ─── 加载推送日志 ─── */
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLogsLoading(true);
      try {
        // 用 push API 的 GET 获取日志（暂用简单方案）
        const res = await fetch('/api/admin/push/logs');
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs ?? []);
        }
      } catch {} finally {
        setLogsLoading(false);
      }
    })();
  }, [isAdmin]);

  /* ─── 过滤群列表 ─── */
  const filteredChats = useMemo(() => {
    if (!chatSearch) return chats;
    const q = chatSearch.toLowerCase();
    return chats.filter((c) => c.name.toLowerCase().includes(q));
  }, [chats, chatSearch]);

  /* ─── 选中/取消 ─── */
  const toggleItem = (item: ContentItem) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  };

  const toggleAll = (items: ContentItem[]) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const allSelected = items.every((i) => next.has(i.id));
      if (allSelected) items.forEach((i) => next.delete(i.id));
      else items.forEach((i) => next.set(i.id, i));
      return next;
    });
  };

  /* ─── 推送 ─── */
  const handlePush = async () => {
    const chat = chats.find((c) => c.chat_id === selectedChatId);
    if (!chat) { message.warning('请选择目标群聊'); return; }
    if (selected.size === 0) { message.warning('请选择要推送的内容'); return; }

    setPushing(true);
    try {
      const items = Array.from(selected.values()).map((i) => ({
        content_type: i.type,
        content_id: i.id,
      }));
      const res = await fetch('/api/admin/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: selectedChatId, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '推送失败');
      message.success(`推送完成：${data.success} 条成功${data.failed ? `，${data.failed} 条失败` : ''}`);
      setSelected(new Map());
      // 刷新日志
      const logRes = await fetch('/api/admin/push/logs');
      if (logRes.ok) {
        const logData = await logRes.json();
        setLogs(logData.logs ?? []);
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '推送失败');
    } finally {
      setPushing(false);
    }
  };

  if (authLoading) return <div className="flex justify-center items-center min-h-[60vh]"><Spin size="large" /></div>;
  if (!isAdmin) return null;

  const selectedChat = chats.find((c) => c.chat_id === selectedChatId);
  const currentItems = contentMap[activeTab] ?? [];

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
        {/* 标题 */}
        <div className="flex items-center gap-3 mb-6">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
            style={{ background: 'var(--gradient-primary)', color: '#fff', boxShadow: '0 4px 15px rgba(26,58,138,0.25)' }}>
            <SendOutlined />
          </span>
          <div>
            <h1 className="text-xl font-bold">飞书推送</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              选择内容，推送到飞书群
            </p>
          </div>
        </div>

        {/* 左右分栏 */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

          {/* 左侧：选择 */}
          <div>
            {/* ① 目标群聊 */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>① 选择目标群聊</h3>
              <Input
                prefix={<SearchOutlined />}
                placeholder="搜索群名..."
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                size="small"
                allowClear
                style={{ marginBottom: 8 }}
              />
              <div className="max-h-[160px] overflow-y-auto rounded-lg" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
                {chatsLoading ? (
                  <div className="p-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>加载中...</div>
                ) : filteredChats.length === 0 ? (
                  <div className="p-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>未找到群聊</div>
                ) : (
                  filteredChats.map((chat) => (
                    <div
                      key={chat.chat_id}
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm transition-colors"
                      style={{
                        background: selectedChatId === chat.chat_id ? 'rgba(26,58,138,0.06)' : 'transparent',
                        borderBottom: '1px solid rgba(0,0,0,0.04)',
                      }}
                      onClick={() => {
                        setSelectedChatId(chat.chat_id);
                        localStorage.setItem('push_chat_id', chat.chat_id);
                      }}
                    >
                      <WechatOutlined style={{ color: 'var(--primary)', fontSize: 14 }} />
                      <span className="flex-1 truncate">{chat.name}</span>
                      <Tag color={chat.chat_type === 'external' ? 'orange' : 'blue'} className="text-[10px]">
                        {chat.chat_type === 'external' ? '外部' : '内部'}
                      </Tag>
                    </div>
                  ))
                )}
              </div>
              {selectedChat && (
                <div className="mt-2 text-xs" style={{ color: 'var(--primary)' }}>
                  ✅ 已选：{selectedChat.name}
                </div>
              )}
            </div>

            {/* ② 内容选择 */}
            <div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                ② 选择内容
                {selected.size > 0 && <span className="ml-2 text-xs" style={{ color: 'var(--primary)' }}>已选 {selected.size} 条</span>}
              </h3>
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                size="small"
                items={CONTENT_TABS.map((tab) => ({
                  key: tab.key,
                  label: tab.label,
                }))}
              />
              {contentLoading ? (
                <div className="py-8 text-center"><Spin /></div>
              ) : currentItems.length === 0 ? (
                <Empty description="暂无内容" />
              ) : (
                <div className="max-h-[300px] overflow-y-auto rounded-lg" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
                  {/* 全选 */}
                  <div className="flex items-center gap-2 px-3 py-2 text-xs" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', color: 'var(--text-muted)' }}>
                    <Checkbox
                      checked={currentItems.length > 0 && currentItems.every((i) => selected.has(i.id))}
                      indeterminate={currentItems.some((i) => selected.has(i.id)) && !currentItems.every((i) => selected.has(i.id))}
                      onChange={() => toggleAll(currentItems)}
                    >
                      全选
                    </Checkbox>
                    <span>{currentItems.length} 条</span>
                  </div>
                  {currentItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-2 px-3 py-2 cursor-pointer text-sm transition-colors"
                      style={{
                        background: selected.has(item.id) ? 'rgba(26,58,138,0.04)' : 'transparent',
                        borderBottom: '1px solid rgba(0,0,0,0.04)',
                      }}
                      onClick={() => toggleItem(item)}
                    >
                      <Checkbox checked={selected.has(item.id)} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.title}</div>
                        {(item.category || item.instructor) && (
                          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {item.category}{item.instructor ? ` · ${item.instructor}` : ''}
                          </div>
                        )}
                        {item.description && (
                          <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                            {item.description.slice(0, 60)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ③ 推送按钮 */}
            <div className="mt-4 flex items-center gap-3">
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={pushing}
                onClick={handlePush}
                disabled={!selectedChat || selected.size === 0}
              >
                推送到{selectedChat ? ` ${selectedChat.name}` : ''}
              </Button>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                共 {selected.size} 条内容{selectedChat ? ` → ${selectedChat.name}` : ''}
              </span>
            </div>
          </div>

          {/* 右侧：预览 */}
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>卡片预览</h3>
            {selected.size === 0 ? (
              <div className="rounded-xl p-8 text-center" style={{ background: 'rgba(0,0,0,0.02)', border: '1px dashed rgba(0,0,0,0.1)' }}>
                <Empty description="选择内容后预览卡片效果" />
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {Array.from(selected.values()).map((item) => (
                  <PreviewCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 推送历史 */}
        {logs.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>推送历史</h3>
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                    <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>时间</th>
                    <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>类型</th>
                    <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>标题</th>
                    <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>目标群</th>
                    <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <td className="px-3 py-2">{new Date(log.created_at).toLocaleString('zh-CN')}</td>
                      <td className="px-3 py-2"><Tag>{TYPE_LABELS[log.content_type] ?? log.content_type}</Tag></td>
                      <td className="px-3 py-2 truncate max-w-[150px]">{log.content_title}</td>
                      <td className="px-3 py-2 truncate max-w-[120px]">{log.target_chat_name}</td>
                      <td className="px-3 py-2">{log.status === 'sent' ? '✅' : '❌'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── 卡片预览组件 ─── */
function PreviewCard({ item }: { item: ContentItem }) {
  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: 12,
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    background: '#13c2c2', // turquoise
    color: '#fff',
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 600,
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        {item.type === 'course' && '🎓 新课程上线'}
        {item.type === 'resource' && '🛠️ 新工具推荐'}
        {item.type === 'case' && '📚 新案例推荐'}
        {item.type === 'submission' && '📋 大赛方案速览'}
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{item.title}</div>
        {item.instructor && <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>讲师：{item.instructor}</div>}
        {item.category && <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>分类：{item.category}</div>}
        {item.difficulty && <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>难度：{item.difficulty}</div>}
        {item.description && (
          <div style={{ fontSize: 11, color: '#888', marginTop: 6, lineHeight: 1.5 }}>
            {item.description.slice(0, 100)}{item.description.length > 100 ? '...' : ''}
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <span style={{
            display: 'inline-block', padding: '4px 12px', borderRadius: 6,
            background: '#13c2c2', color: '#fff', fontSize: 11, fontWeight: 500,
          }}>
            查看详情
          </span>
        </div>
      </div>
    </div>
  );
}
