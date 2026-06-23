import { NextRequest, NextResponse } from 'next/server';
import {
  buildPublishedCasePointEvents,
  buildPublishedResourcePointEvents,
  type ContributionPointEvent,
  getLevelProgress,
  getUserLevelByPoints,
  USER_LEVEL_THRESHOLDS,
} from '@/lib/user-growth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

type TargetType = 'app' | 'course' | 'case' | 'topic';

interface ProfileItem {
  id: string;
  type: TargetType | 'competition' | 'point';
  title: string;
  description: string;
  status?: string | null;
  href?: string;
  created_at?: string | null;
  points?: number;
}

interface InteractionRow {
  id: string;
  target_type: TargetType;
  target_id: string;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  app: '工具',
  course: '课程',
  case: '案例',
  topic: '话题',
  competition: 'AI大赛',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '待审核',
  published: '已发布',
  rejected: '已驳回',
  draft: '草稿',
};

export async function GET(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    const db = getSupabaseAdmin();
    const { data: user, error: userError } = await db
      .from('users')
      .select('id, name, avatar, department, roles, points, level')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const [
      bookmarks,
      likes,
      appContributions,
      publishedAppsForPoints,
      caseContributions,
      publishedCasesForPoints,
      competitionRows,
    ] = await Promise.all([
      fetchInteractions('bookmarks', userId),
      fetchInteractions('likes', userId),
      fetchRows(() => db
        .from('apps')
        .select('id, name, description, category, status, like_count, created_at')
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(12)),
      fetchRows(() => db
        .from('apps')
        .select('id, status, created_at')
        .eq('author_id', userId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(1000)),
      fetchRows(() => db
        .from('cases')
        .select('id, title, summary, status, like_count, bookmark_count, created_at')
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(12)),
      fetchRows(() => db
        .from('cases')
        .select('id, status, created_at')
        .eq('author_id', userId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(1000)),
      fetchRows(() => db
        .from('competition_submissions')
        .select('id, title, submitter, team_members, status, record_url, created_at')
        .order('created_at', { ascending: false })
        .limit(300)),
    ]);

    const contributionPointEvents = [
      ...buildPublishedResourcePointEvents(publishedAppsForPoints.map((item) => ({
        id: item.id,
        author_id: userId,
        status: item.status,
      }))),
      ...buildPublishedCasePointEvents(publishedCasesForPoints.map((item) => ({
        id: item.id,
        author_id: userId,
        status: item.status,
      }))),
    ];
    const contributionCreatedAtEntries: Array<[string, unknown]> = [
      ...publishedAppsForPoints.map((item): [string, unknown] => [`resource_published:${String(item.id)}`, item.created_at]),
      ...publishedCasesForPoints.map((item): [string, unknown] => [`case_published:${String(item.id)}`, item.created_at]),
    ];
    const contributionCreatedAtByKey = new Map<string, unknown>(contributionCreatedAtEntries);

    await ensureContributionPointEvents(db, userId, contributionPointEvents, contributionCreatedAtByKey);

    const [pointEvents, pointTotalRows] = await Promise.all([
      fetchRows(() => db
        .from('user_point_events')
        .select('id, source_type, source_id, reason, points, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)),
      fetchRows(() => db
        .from('user_point_events')
        .select('points')
        .eq('user_id', userId)),
    ]);

    const filteredCompetitions = competitionRows.filter((row) => {
      const submitters = toNameArray(row.submitter);
      const members = toNameArray(row.team_members);
      return submitters.includes(user.name) || members.includes(user.name);
    });

    const eventPoints = pointTotalRows.reduce((sum, event) => sum + Number(event.points ?? 0), 0);
    const contributionPoints = contributionPointEvents.reduce((sum, event) => sum + event.points, 0);
    const points = pointTotalRows.length > 0
      ? eventPoints
      : Math.max(Number(user.points ?? 0), contributionPoints);
    const levelProgress = getLevelProgress(points);

    const bookmarkItems = await enrichInteractions(bookmarks);
    const likeItems = await enrichInteractions(likes);
    const contributionItems = [
      ...appContributions.map((item): ProfileItem => ({
        id: item.id,
        type: 'app',
        title: item.name ?? '未命名工具',
        description: `${STATUS_LABELS[item.status] ?? item.status ?? '未设置状态'} · ${item.category ?? '工具推荐'} · ${Number(item.like_count ?? 0)} 赞`,
        status: item.status,
        href: '/resources?tab=apps',
        created_at: item.created_at,
      })),
      ...caseContributions.map((item): ProfileItem => ({
        id: item.id,
        type: 'case',
        title: item.title ?? '未命名案例',
        description: `${STATUS_LABELS[item.status] ?? item.status ?? '未设置状态'} · ${item.summary ?? '案例贡献'}`,
        status: item.status,
        href: '/wish-pool',
        created_at: item.created_at,
      })),
      ...filteredCompetitions.map((item): ProfileItem => ({
        id: item.id,
        type: 'competition',
        title: item.title ?? '未命名大赛方案',
        description: `${TYPE_LABELS.competition} · ${item.status ?? '评审中'}`,
        status: item.status,
        href: item.record_url ?? '/competitions',
        created_at: item.created_at,
      })),
    ].sort(byCreatedAtDesc).slice(0, 12);

    const pointItems = pointEvents.length > 0
      ? pointEvents.map((event): ProfileItem => ({
          id: event.id,
          type: 'point',
          title: pointReasonLabel(event.reason),
          description: pointSourceLabel(event.source_type),
          points: Number(event.points ?? 0),
          created_at: event.created_at,
        }))
      : contributionPointEvents.map((event): ProfileItem => ({
          id: `${event.reason}:${event.sourceId}`,
          type: 'point',
          title: pointReasonLabel(event.reason),
          description: pointSourceLabel(sourceTypeFromContributionReason(event.reason)),
          points: event.points,
          created_at: contributionCreatedAtByKey.get(`${event.reason}:${event.sourceId}`) as string | null | undefined,
        })).sort(byCreatedAtDesc).slice(0, 20);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        department: user.department,
        roles: user.roles ?? [],
      },
      stats: {
        points,
        level: levelProgress.level,
        nextLevel: levelProgress.nextLevel,
        pointsToNext: levelProgress.pointsToNext,
        levelProgress: levelProgress.progress,
        contributions: contributionItems.length,
        bookmarks: bookmarks.length,
        likes: likes.length,
      },
      levels: USER_LEVEL_THRESHOLDS,
      lists: {
        contributions: contributionItems,
        bookmarks: bookmarkItems,
        likes: likeItems,
        points: pointItems,
      },
    });
  } catch (err) {
    console.error('[profile/summary] failed:', err);
    return NextResponse.json({ error: '获取个人中心数据失败' }, { status: 500 });
  }
}

async function fetchInteractions(table: 'bookmarks' | 'likes', userId: string): Promise<InteractionRow[]> {
  return fetchRows(async () => {
    const db = getSupabaseAdmin();
    return db
      .from(table)
      .select('id, target_type, target_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(24);
  }) as Promise<InteractionRow[]>;
}

async function fetchRows<T extends Record<string, unknown>>(run: () => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>): Promise<T[]> {
  const { data, error } = await run();
  if (error) {
    console.warn('[profile/summary] optional query failed:', error.message ?? error);
    return [];
  }
  return data ?? [];
}

async function ensureContributionPointEvents(
  db: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  events: ContributionPointEvent[],
  createdAtByKey: Map<string, unknown>,
) {
  if (events.length === 0) return;

  const { error: upsertErr } = await db
    .from('user_point_events')
    .upsert(events.map((event) => ({
      user_id: event.userId,
      source_type: sourceTypeFromContributionReason(event.reason),
      source_id: event.sourceId,
      reason: event.reason,
      points: event.points,
      created_at: createdAtByKey.get(`${event.reason}:${event.sourceId}`) ?? undefined,
    })), { onConflict: 'user_id,source_type,source_id,reason' });
  if (upsertErr) {
    console.warn('[profile/summary] skip point event persistence:', upsertErr.message ?? upsertErr);
    return;
  }

  const { data: allPointRows, error: pointsErr } = await db
    .from('user_point_events')
    .select('points')
    .eq('user_id', userId);
  if (pointsErr) {
    console.warn('[profile/summary] skip point total update:', pointsErr.message ?? pointsErr);
    return;
  }

  const points = (allPointRows ?? []).reduce((sum, row) => sum + Number(row.points ?? 0), 0);
  const { error: updateErr } = await db
    .from('users')
    .update({ points, level: getUserLevelByPoints(points) })
    .eq('id', userId);
  if (updateErr) {
    console.warn('[profile/summary] skip user point update:', updateErr.message ?? updateErr);
  }
}

async function enrichInteractions(rows: InteractionRow[]): Promise<ProfileItem[]> {
  const grouped = rows.reduce<Record<TargetType, string[]>>((acc, row) => {
    if (!['app', 'course', 'case', 'topic'].includes(row.target_type)) return acc;
    acc[row.target_type] = [...(acc[row.target_type] ?? []), row.target_id];
    return acc;
  }, { app: [], course: [], case: [], topic: [] });

  const db = getSupabaseAdmin();
  const [apps, courses, cases, topics] = await Promise.all([
    grouped.app.length
      ? fetchRows(() => db.from('apps').select('id, name, description, category, status').in('id', grouped.app))
      : Promise.resolve([]),
    grouped.course.length
      ? fetchRows(() => db.from('courses').select('id, title, description, difficulty').in('id', grouped.course))
      : Promise.resolve([]),
    grouped.case.length
      ? fetchRows(() => db.from('cases').select('id, title, summary, status').in('id', grouped.case))
      : Promise.resolve([]),
    grouped.topic.length
      ? fetchRows(() => db.from('topics').select('id, title, content').in('id', grouped.topic))
      : Promise.resolve([]),
  ]);

  const targetMap = new Map<string, ProfileItem>();
  for (const item of apps) {
    targetMap.set(`app:${item.id}`, {
      id: item.id as string,
      type: 'app',
      title: String(item.name ?? '未命名工具'),
      description: `${TYPE_LABELS.app} · ${item.category ?? STATUS_LABELS[String(item.status)] ?? '工具推荐'}`,
      status: item.status as string | null,
      href: '/resources?tab=apps',
    });
  }
  for (const item of courses) {
    targetMap.set(`course:${item.id}`, {
      id: item.id as string,
      type: 'course',
      title: String(item.title ?? '未命名课程'),
      description: `${TYPE_LABELS.course} · ${item.difficulty ?? 'AI公开课'}`,
      href: '/resources?tab=courses',
    });
  }
  for (const item of cases) {
    targetMap.set(`case:${item.id}`, {
      id: item.id as string,
      type: 'case',
      title: String(item.title ?? '未命名案例'),
      description: `${TYPE_LABELS.case} · ${item.summary ?? STATUS_LABELS[String(item.status)] ?? '案例'}`,
      status: item.status as string | null,
      href: '/wish-pool',
    });
  }
  for (const item of topics) {
    targetMap.set(`topic:${item.id}`, {
      id: item.id as string,
      type: 'topic',
      title: String(item.title ?? '未命名话题'),
      description: `${TYPE_LABELS.topic} · ${String(item.content ?? '').slice(0, 40)}`,
      href: '#',
    });
  }

  return rows.map((row) => {
    const target = targetMap.get(`${row.target_type}:${row.target_id}`);
    return {
      id: row.id,
      type: row.target_type,
      title: target?.title ?? '内容已删除或不可见',
      description: target?.description ?? TYPE_LABELS[row.target_type] ?? row.target_type,
      status: target?.status,
      href: target?.href,
      created_at: row.created_at,
    };
  });
}

function toNameArray(value: unknown): string[] {
  if (!Array.isArray(value)) return typeof value === 'string' ? [value] : [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function byCreatedAtDesc(a: ProfileItem, b: ProfileItem) {
  return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
}

function pointReasonLabel(reason: unknown) {
  switch (reason) {
    case 'competition_submitter':
      return 'AI大赛提报人';
    case 'competition_member':
      return 'AI大赛参与成员';
    case 'case_published':
      return '发布案例';
    case 'resource_published':
      return '发布工具';
    case 'legacy_points':
      return '历史积分';
    default:
      return '成长积分';
  }
}

function pointSourceLabel(sourceType: unknown) {
  if (sourceType === 'competition_submission') return '参与 AI 大赛自动获得';
  if (sourceType === 'case') return '历史已发布案例自动补记';
  if (sourceType === 'app') return '历史已发布工具自动补记';
  return '历史成长值保留';
}

function sourceTypeFromContributionReason(reason: unknown) {
  return reason === 'resource_published' ? 'app' : 'case';
}
