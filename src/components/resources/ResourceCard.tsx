'use client';

import { Avatar, Tag } from 'antd';
import {
  BookFilled,
  BookOutlined,
  EditOutlined,
  LikeFilled,
  LikeOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { RESOURCE_CATEGORY_COLORS } from '@/lib/constants';
import type { Resource } from '@/types';
import DepartmentTags from './DepartmentTags';

interface ResourceCardProps {
  resource: Resource;
  allDepartments?: string[];
  surface?: 'glass' | 'soft';
  accent?: 'primary' | 'orange';
  showCategory?: boolean;
  showScenarios?: boolean;
  showDates?: boolean;
  compact?: boolean;
  canEdit?: boolean;
  onEdit?: (resource: Resource) => void;
  interactions?: { liked: boolean; bookmarked: boolean };
  counts?: { like_count: number; bookmark_count: number };
  onToggleInteraction?: (resourceId: string, action: 'like' | 'bookmark') => void;
}

export default function ResourceCard({
  resource,
  allDepartments = [],
  surface = 'glass',
  accent = 'primary',
  showCategory = true,
  showScenarios = true,
  showDates = true,
  compact = false,
  canEdit = false,
  onEdit,
  interactions,
  counts,
  onToggleInteraction,
}: ResourceCardProps) {
  const hasInteractions = Boolean(onToggleInteraction);
  const logoSize = compact ? 'w-11 h-11 text-lg' : 'w-12 h-12 text-xl';
  const accentColor = accent === 'orange' ? 'var(--accent)' : 'var(--primary)';
  const logoBg = accent === 'orange' ? 'rgba(242, 127, 34, 0.11)' : 'rgba(26, 58, 138, 0.06)';
  const surfaceClass = surface === 'glass'
    ? 'glass border-transparent'
    : 'border border-white/70 bg-white/65';
  const departmentValues = resource.applicable_departments ?? [];

  return (
    <div
      className={[
        surfaceClass,
        'group relative flex h-full flex-col overflow-hidden rounded-[18px] p-4 transition-all duration-300 hover:-translate-y-1',
        compact ? 'gap-3' : 'gap-3.5',
      ].join(' ')}
      style={surface === 'glass' ? { borderColor: 'rgba(255, 255, 255, 0.6)' } : undefined}
    >
      {surface === 'glass' && (
        <div className="absolute left-0 top-0 h-[3px] w-full opacity-0 transition-opacity group-hover:opacity-100" style={{ background: 'var(--gradient-primary)' }} />
      )}

      {canEdit && (
        <button
          onClick={() => onEdit?.(resource)}
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg opacity-0 transition-all group-hover:opacity-100 hover:opacity-100"
          style={{ background: 'rgba(255,255,255,0.88)', color: 'var(--text-secondary)' }}
          title="编辑"
        >
          <EditOutlined style={{ fontSize: 13 }} />
        </button>
      )}

      <div className="flex items-start gap-3">
        <div
          className={`${logoSize} flex shrink-0 items-center justify-center overflow-hidden rounded-xl font-bold`}
          style={{ background: logoBg, color: accentColor }}
        >
          {resource.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resource.logo} alt={resource.name} className="h-full w-full object-cover" />
          ) : (
            resource.name[0]
          )}
        </div>
        <div className="min-w-0 flex-1 pr-5">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className={`${compact ? 'text-sm' : 'text-base'} min-w-0 truncate font-semibold`}>
              {resource.name}
            </h3>
            {showCategory && (
              <Tag color={(RESOURCE_CATEGORY_COLORS as Record<string, string>)[resource.category] ?? 'default'} className="m-0 shrink-0 text-[11px]">
                {resource.category}
              </Tag>
            )}
          </div>
          {(resource.author?.name || showDates) && (
            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <Avatar src={resource.author?.avatar || undefined} icon={<UserOutlined />} size={16} />
              {resource.author?.name && <span className="truncate">来自 {resource.author.name}</span>}
              {showDates && (
                <>
                  {resource.author?.name && <span className="shrink-0">·</span>}
                  <span className="shrink-0">{new Date(resource.created_at).toLocaleDateString('zh-CN')}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="line-clamp-2 text-sm leading-5" style={{ color: 'var(--text-secondary)' }}>
        {resource.description}
      </p>

      {((showScenarios && resource.scenarios.length > 0) || departmentValues.length > 0) && (
        <div className="space-y-1.5">
          {showScenarios && resource.scenarios.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold shrink-0" style={{ color: 'var(--text-muted)' }}>
                适用场景：
              </span>
              {resource.scenarios.slice(0, 3).map((scenario) => (
                <Tag key={scenario} className="m-0 text-[11px]">{scenario}</Tag>
              ))}
              {resource.scenarios.length > 3 && (
                <Tag className="m-0 text-[11px]">+{resource.scenarios.length - 3}</Tag>
              )}
            </div>
          )}
          {departmentValues.length > 0 && (
            <DepartmentTags
              departments={departmentValues}
              allDepartments={allDepartments}
              max={2}
              className="text-[11px]"
            />
          )}
        </div>
      )}

      <div className="mt-auto border-t pt-2.5" style={{ borderColor: 'rgba(255, 255, 255, 0.42)' }}>
        <div className="flex items-end justify-between gap-3">
          {resource.official_url ? (
            <a
              href={resource.official_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all hover:-translate-y-0.5"
              style={{
                background: 'var(--primary)',
                boxShadow: '0 6px 16px rgba(26,58,138,0.18)',
                color: '#fff',
              }}
            >
              查看详情
            </a>
          ) : (
            <span aria-hidden="true" />
          )}
          {hasInteractions ? (
            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              <button
                type="button"
                className="inline-flex items-center gap-1 transition-colors hover:text-red-500"
                style={{ color: interactions?.liked ? '#e74c3c' : undefined }}
                onClick={() => onToggleInteraction?.(resource.id, 'like')}
              >
                {interactions?.liked ? <LikeFilled /> : <LikeOutlined />} {counts?.like_count ?? 0}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 transition-colors hover:text-yellow-500"
                style={{ color: interactions?.bookmarked ? '#f59e0b' : undefined }}
                onClick={() => onToggleInteraction?.(resource.id, 'bookmark')}
              >
                {interactions?.bookmarked ? <BookFilled /> : <BookOutlined />} {counts?.bookmark_count ?? 0}
              </button>
            </div>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  );
}
