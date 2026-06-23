'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Avatar, Button, Progress, Spin, Tag } from 'antd';
import {
  AppstoreOutlined,
  BookOutlined,
  FireOutlined,
  LikeOutlined,
  LinkOutlined,
  PlusOutlined,
  ReadOutlined,
  StarOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import type { UserLevel } from '@/types';

type ActivityType = 'contributions' | 'bookmarks' | 'likes' | 'points';

interface ProfileItem {
  id: string;
  type: string;
  title: string;
  description: string;
  status?: string | null;
  href?: string;
  created_at?: string | null;
  points?: number;
}

interface LevelThreshold {
  minPoints: number;
  level: UserLevel;
}

interface ProfileSummary {
  user: {
    id: string;
    name: string;
    avatar: string | null;
    department: string | null;
    roles: string[];
  };
  stats: {
    points: number;
    level: UserLevel;
    nextLevel: UserLevel | null;
    pointsToNext: number;
    levelProgress: number;
    contributions: number;
    bookmarks: number;
    likes: number;
  };
  levels: LevelThreshold[];
  lists: Record<ActivityType, ProfileItem[]>;
}

const ACTIVITY_TABS: Array<{ key: ActivityType; label: string; icon: React.ReactNode }> = [
  { key: 'contributions', label: '我的贡献', icon: <BookOutlined /> },
  { key: 'bookmarks', label: '我的收藏', icon: <StarOutlined /> },
  { key: 'likes', label: '我的点赞', icon: <LikeOutlined /> },
  { key: 'points', label: '积分记录', icon: <FireOutlined /> },
];

const STATUS_COLORS: Record<string, string> = {
  published: 'green',
  pending: 'gold',
  rejected: 'red',
  draft: 'default',
};

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [activeTab, setActiveTab] = useState<ActivityType>('contributions');

  useEffect(() => {
    if (!user) return;

    let active = true;
    fetch('/api/profile/summary', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('profile summary failed');
        return res.json() as Promise<ProfileSummary>;
      })
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch((err) => {
        console.error('Failed to load profile summary:', err);
        if (active) {
          setSummary(null);
          setLoadFailed(true);
        }
      });

    return () => {
      active = false;
    };
  }, [user]);

  const displayUser = summary?.user ?? user;
  const roleLabel = useMemo(() => {
    const roles = displayUser?.roles ?? [];
    if (roles.includes('admin')) return '管理员';
    if (roles.includes('reviewer')) return '评审';
    return '用户';
  }, [displayUser?.roles]);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <main className="px-4 sm:px-6 py-8">
        <section className="mx-auto max-w-3xl text-center py-16 glass rounded-2xl" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
          <UserOutlined className="text-4xl mb-4" style={{ color: 'var(--text-muted)' }} />
          <p className="mb-4" style={{ color: 'var(--text-muted)' }}>请先登录</p>
          <Link href="/login" className="text-sm font-medium px-4 py-2 rounded-lg" style={{ color: 'var(--primary)', background: 'rgba(26,58,138,0.06)' }}>
            去登录
          </Link>
        </section>
      </main>
    );
  }

  const stats = summary?.stats ?? {
    points: user.points ?? 0,
    level: user.level,
    nextLevel: null,
    pointsToNext: 0,
    levelProgress: 0,
    contributions: 0,
    bookmarks: 0,
    likes: 0,
  };
  const activeItems = summary?.lists[activeTab] ?? [];
  const loading = !summary && !loadFailed;

  return (
    <main className="px-4 sm:px-6 lg:px-[100px] py-6 sm:py-8">
      <div className="mx-auto max-w-[1400px]">
        <section
          className="glass relative overflow-hidden rounded-2xl p-5 sm:p-7 lg:p-8 mb-5"
          style={{ borderColor: 'rgba(255,255,255,0.6)' }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 12% 20%, rgba(26,58,138,0.14), transparent 32%), radial-gradient(circle at 88% 82%, rgba(242,127,34,0.14), transparent 34%)',
            }}
          />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
            <div className="flex flex-col justify-between gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <Avatar
                  size={84}
                  src={displayUser?.avatar || undefined}
                  icon={<UserOutlined />}
                  style={{ border: '3px solid rgba(255,255,255,0.75)', boxShadow: '0 12px 30px rgba(26,58,138,0.14)' }}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{displayUser?.name}</h1>
                    <Tag color="blue">{stats.level}</Tag>
                  </div>
                  <p className="text-sm sm:text-base mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {displayUser?.department || '未设置部门'} · {roleLabel}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
                <QuickAction
                  href="/resources/apps/create"
                  icon={<AppstoreOutlined />}
                  title="提交工具"
                  desc="推荐 AI 工具"
                />
                <QuickAction
                  href="/resources?tab=apps"
                  icon={<StarOutlined />}
                  title="发现工具"
                  desc="收藏点赞资源"
                />
                <QuickAction
                  href="/competitions"
                  icon={<TrophyOutlined />}
                  title="AI大赛"
                  desc="提报 +50"
                />
                <QuickAction
                  href="/resources?tab=courses"
                  icon={<ReadOutlined />}
                  title="AI公开课"
                  desc="课程资源"
                />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard icon={<FireOutlined />} label="成长值" value={stats.points} tone="primary" />
                <MetricCard icon={<BookOutlined />} label="贡献" value={stats.contributions} tone="accent" />
                <MetricCard icon={<StarOutlined />} label="收藏" value={stats.bookmarks} tone="primary" />
                <MetricCard icon={<LikeOutlined />} label="点赞" value={stats.likes} tone="accent" />
              </div>
            </div>

            <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.48)', border: '1px solid rgba(255,255,255,0.65)' }}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>AI等级</p>
                  <h2 className="text-xl font-bold mt-1">{stats.level}</h2>
                </div>
                <span className="w-12 h-12 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(242,127,34,0.12)', color: 'var(--accent)' }}>
                  <TrophyOutlined />
                </span>
              </div>
              <Progress percent={stats.levelProgress} showInfo={false} strokeColor="var(--accent)" railColor="rgba(26,58,138,0.08)" />
              <div className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {stats.nextLevel ? `距离「${stats.nextLevel}」还差 ${stats.pointsToNext} 分` : '已达到当前最高等级'}
              </div>
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(summary?.levels ?? []).map((item) => (
                  <div
                    key={item.level}
                    className="rounded-lg px-3 py-2"
                    style={{
                      background: item.level === stats.level ? 'rgba(242,127,34,0.12)' : 'rgba(26,58,138,0.05)',
                      border: item.level === stats.level ? '1px solid rgba(242,127,34,0.28)' : '1px solid rgba(26,58,138,0.08)',
                    }}
                  >
                    <div className="text-xs font-semibold truncate">{item.level}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.minPoints}+ 分</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="glass rounded-2xl p-4 sm:p-5" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">我的 AI 足迹</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>贡献、收藏、点赞、积分记录合并在这里</p>
            </div>
            {loading && <Spin size="small" />}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {ACTIVITY_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className="h-11 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                style={{
                  background: activeTab === tab.key ? 'var(--primary)' : 'rgba(255,255,255,0.46)',
                  color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
                  border: activeTab === tab.key ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.62)',
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {activeItems.length === 0 ? (
            <EmptyActivity activeTab={activeTab} />
          ) : (
            <div className="grid gap-3">
              {activeItems.map((item) => (
                <ActivityRow key={`${item.type}-${item.id}`} item={item} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function MetricCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: 'primary' | 'accent' }) {
  return (
    <div className="rounded-2xl px-4 py-4 min-h-[104px] flex flex-col justify-between" style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.65)' }}>
      <div className="flex items-center justify-between">
        <span style={{ color: tone === 'primary' ? 'var(--primary)' : 'var(--accent)' }}>{icon}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div className="text-3xl font-bold tabular-nums" style={{ color: tone === 'primary' ? 'var(--primary)' : 'var(--accent)' }}>
        {value}
      </div>
    </div>
  );
}

function ActivityRow({ item }: { item: ProfileItem }) {
  const content = (
    <div className="rounded-xl px-4 py-3 flex items-center gap-3 transition-all hover:-translate-y-0.5" style={{ background: 'rgba(255,255,255,0.48)', border: '1px solid rgba(255,255,255,0.62)' }}>
      <span className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center" style={{ background: 'rgba(26,58,138,0.07)', color: 'var(--primary)' }}>
        {activityIcon(item.type)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-semibold truncate">{item.title}</h3>
          {item.status && <Tag color={STATUS_COLORS[item.status] ?? 'blue'}>{statusLabel(item.status)}</Tag>}
          {typeof item.points === 'number' && <Tag color="orange">+{item.points}</Tag>}
        </div>
        <p className="text-sm truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.description}</p>
      </div>
      <div className="hidden sm:block text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
        {formatDate(item.created_at)}
      </div>
      {item.href && <LinkOutlined style={{ color: 'var(--text-muted)' }} />}
    </div>
  );

  if (!item.href || item.href === '#') return content;
  if (item.href.startsWith('http')) {
    return <a href={item.href} target="_blank" rel="noreferrer" className="block">{content}</a>;
  }
  return <Link href={item.href} className="block">{content}</Link>;
}

function EmptyActivity({ activeTab }: { activeTab: ActivityType }) {
  const emptyText: Record<ActivityType, { title: string; desc: string; href: string; action: string }> = {
    contributions: { title: '还没有贡献记录', desc: '提交一个工具或参与 AI 大赛后会自动出现在这里', href: '/resources/apps/create', action: '提交工具' },
    bookmarks: { title: '还没有收藏', desc: '遇到好用的课程或工具，点收藏后会自动归档', href: '/resources?tab=apps', action: '去发现' },
    likes: { title: '还没有点赞', desc: '给有帮助的内容点个赞，之后可以在这里回看', href: '/resources?tab=apps', action: '去浏览' },
    points: { title: '还没有积分记录', desc: '参与 AI 大赛或后续成长动作后会生成记录', href: '/competitions', action: '看大赛' },
  };
  const item = emptyText[activeTab];

  return (
    <div className="min-h-[260px] rounded-2xl flex flex-col items-center justify-center text-center px-4" style={{ background: 'rgba(255,255,255,0.36)', border: '1px solid rgba(255,255,255,0.62)' }}>
      <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl mb-3" style={{ background: 'rgba(26,58,138,0.07)', color: 'var(--primary)' }}>
        {activityIcon(activeTab)}
      </span>
      <h3 className="font-semibold">{item.title}</h3>
      <p className="text-sm mt-1 mb-4 max-w-[320px]" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
      <Link href={item.href}>
        <Button type="primary" icon={<PlusOutlined />}>{item.action}</Button>
      </Link>
    </div>
  );
}

function QuickAction({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="block">
      <div className="rounded-xl px-3 py-2.5 min-h-[72px] flex items-center gap-2.5 transition-all hover:-translate-y-0.5"
        style={{ background: 'rgba(255,255,255,0.42)', border: '1px solid rgba(255,255,255,0.62)' }}>
        <span className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(242,127,34,0.1)', color: 'var(--accent)' }}>
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{title}</div>
          <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{desc}</div>
        </div>
      </div>
    </Link>
  );
}

function activityIcon(type: string) {
  switch (type) {
    case 'bookmarks':
    case 'app':
      return <AppstoreOutlined />;
    case 'likes':
      return <LikeOutlined />;
    case 'course':
      return <ReadOutlined />;
    case 'competition':
      return <TrophyOutlined />;
    case 'point':
    case 'points':
      return <FireOutlined />;
    default:
      return <BookOutlined />;
  }
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    published: '已发布',
    pending: '待审核',
    rejected: '已驳回',
    draft: '草稿',
  };
  return labels[status] ?? status;
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
