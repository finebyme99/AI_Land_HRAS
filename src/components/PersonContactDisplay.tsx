'use client';

import { Avatar, Popover } from 'antd';
import {
  buildFeishuChatUrl,
  profilesFromNames,
  type PersonProfile,
} from '@/lib/person-profile';

export const PERSON_PROFILE_UNAVAILABLE_TEXT = '无权限/暂无资料';

export function getDisplayProfiles(profiles: PersonProfile[] | undefined, names: string[] | undefined): PersonProfile[] {
  if (profiles && profiles.length > 0) return profiles;
  return profilesFromNames(names);
}

export function personContactPlainText(profiles: PersonProfile[] | undefined, names: string[] | undefined): string | null {
  const displayProfiles = getDisplayProfiles(profiles, names);
  return displayProfiles.length > 0 ? displayProfiles.map((profile) => profile.name).join(' ') : null;
}

function ProfileMetaRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-9 shrink-0 text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-[11px] font-medium" style={{ color: value ? 'var(--foreground)' : 'var(--text-muted)' }}>{value || PERSON_PROFILE_UNAVAILABLE_TEXT}</span>
    </div>
  );
}

export function PersonHoverName({ profile, compact = false, showAvatar = false }: { profile: PersonProfile; compact?: boolean; showAvatar?: boolean }) {
  const feishuUrl = buildFeishuChatUrl(profile.openId);
  const avatarSize = compact ? 16 : 18;
  const content = (
    <div
      className="w-56"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-2">
        <Avatar size={34} src={profile.avatarUrl}>{profile.name.slice(0, 1)}</Avatar>
        <div className="min-w-0">
          <div className="text-xs font-bold truncate" style={{ color: 'var(--foreground)' }}>{profile.name}</div>
          {profile.email && <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{profile.email}</div>}
        </div>
      </div>
      <div className="space-y-1.5">
        <ProfileMetaRow label="工号" value={profile.employeeId} />
        <ProfileMetaRow label="岗位" value={profile.jobTitle} />
      </div>
      {feishuUrl && (
        <a
          href={feishuUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex mt-2 text-[11px] font-semibold hover:underline"
          style={{ color: '#1a3a8a' }}
          onClick={(event) => event.stopPropagation()}
        >
          打开飞书
        </a>
      )}
    </div>
  );

  return (
    <Popover content={content} trigger="hover" mouseEnterDelay={0.12} styles={{ root: { zIndex: 99999 } }}>
      <span
        className="inline-flex min-w-0 cursor-help items-center gap-1 rounded-full"
        style={{
          maxWidth: compact ? 96 : 136,
          color: '#142033',
          fontSize: compact ? 10 : 12,
          fontWeight: 600,
          overflow: 'hidden',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {showAvatar && (
          <Avatar
            size={avatarSize}
            src={profile.avatarUrl}
            style={{
              flexShrink: 0,
              background: profile.avatarUrl ? 'transparent' : 'rgba(26,58,138,0.16)',
              color: '#1a3a8a',
              fontSize: compact ? 9 : 10,
              fontWeight: 700,
            }}
          >
            {profile.name.slice(0, 1)}
          </Avatar>
        )}
        <span className="min-w-0 truncate">{profile.name}</span>
      </span>
    </Popover>
  );
}

export function PersonContactNames({
  profiles,
  names,
  compact = false,
  limit = 3,
  showAvatar = false,
}: {
  profiles?: PersonProfile[];
  names?: string[];
  compact?: boolean;
  limit?: number;
  showAvatar?: boolean;
}) {
  const displayProfiles = getDisplayProfiles(profiles, names);
  if (displayProfiles.length === 0) return null;

  const visibleProfiles = displayProfiles.slice(0, limit);
  const hiddenProfiles = displayProfiles.slice(limit);

  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {visibleProfiles.map((profile, index) => (
        <PersonHoverName
          key={`${profile.openId ?? profile.name}-${index}`}
          profile={profile}
          compact={compact}
          showAvatar={showAvatar}
        />
      ))}
      {hiddenProfiles.length > 0 && (
        <Popover
          content={<div className="max-w-60">{hiddenProfiles.map((profile, index) => <div key={`${profile.openId ?? profile.name}-${index}`} className="mb-1 last:mb-0"><PersonHoverName profile={profile} compact={false} showAvatar={showAvatar} /></div>)}</div>}
          trigger="hover"
          styles={{ root: { zIndex: 99999 } }}
        >
          <span className="cursor-help text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>等{displayProfiles.length}人</span>
        </Popover>
      )}
    </span>
  );
}
