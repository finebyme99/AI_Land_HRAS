import type { UserLevel } from '../types';

export const USER_LEVEL_THRESHOLDS: ReadonlyArray<{ minPoints: number; level: UserLevel }> = [
  { minPoints: 0, level: '灵识初启' },
  { minPoints: 50, level: '问道学徒' },
  { minPoints: 150, level: '算法筑基' },
  { minPoints: 300, level: '智核结丹' },
  { minPoints: 600, level: '万象化神' },
  { minPoints: 1000, level: '天机掌门' },
];

export const CASE_PUBLISHED_POINTS = 10;
export const RESOURCE_PUBLISHED_POINTS = 10;

export type CompetitionPointReason = 'competition_submitter' | 'competition_member';
export type ContributionPointReason = 'case_published' | 'resource_published';

export interface CompetitionParticipationRow {
  id: unknown;
  submitter?: unknown;
  team_members?: unknown;
  teamMembers?: unknown;
}

export interface CompetitionPointEvent {
  sourceId: string;
  participantName: string;
  reason: CompetitionPointReason;
  points: number;
}

export interface PublishedCaseRow {
  id: unknown;
  author_id?: unknown;
  status?: unknown;
}

export interface PublishedResourceRow {
  id: unknown;
  author_id?: unknown;
  status?: unknown;
}

export interface ContributionPointEvent {
  sourceId: string;
  userId: string;
  reason: ContributionPointReason;
  points: number;
}

export function getUserLevelByPoints(points: number): UserLevel {
  const safePoints = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
  let level: UserLevel = '灵识初启';

  for (const threshold of USER_LEVEL_THRESHOLDS) {
    if (safePoints >= threshold.minPoints) {
      level = threshold.level;
    }
  }

  return level;
}

export interface UserLevelProgress {
  level: UserLevel;
  currentMin: number;
  nextLevel: UserLevel | null;
  nextMin: number | null;
  pointsToNext: number;
  progress: number;
}

export function getLevelProgress(points: number): UserLevelProgress {
  const safePoints = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
  const currentIndex = USER_LEVEL_THRESHOLDS.findLastIndex((threshold) => safePoints >= threshold.minPoints);
  const current = USER_LEVEL_THRESHOLDS[Math.max(0, currentIndex)];
  const next = USER_LEVEL_THRESHOLDS[currentIndex + 1] ?? null;

  if (!next) {
    return {
      level: current.level,
      currentMin: current.minPoints,
      nextLevel: null,
      nextMin: null,
      pointsToNext: 0,
      progress: 100,
    };
  }

  const span = next.minPoints - current.minPoints;
  const progress = span > 0
    ? Math.max(0, Math.min(100, Math.floor(((safePoints - current.minPoints) / span) * 100)))
    : 100;

  return {
    level: current.level,
    currentMin: current.minPoints,
    nextLevel: next.level,
    nextMin: next.minPoints,
    pointsToNext: Math.max(0, next.minPoints - safePoints),
    progress,
  };
}

export function normalizeParticipantNames(value: unknown): string[] {
  if (value == null) return [];

  const rawNames = Array.isArray(value)
    ? value.flatMap((item) => normalizeParticipantNames(item))
    : [participantNameFromValue(value)];

  return [...new Set(rawNames.map((name) => name.trim()).filter(Boolean))];
}

function participantNameFromValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    if ('name' in value && typeof value.name === 'string') return value.name;
    if ('text' in value && typeof value.text === 'string') return value.text;
  }
  return '';
}

export function buildCompetitionPointEvents(rows: CompetitionParticipationRow[]): CompetitionPointEvent[] {
  const events: CompetitionPointEvent[] = [];

  for (const row of rows) {
    const sourceId = typeof row.id === 'string' ? row.id : String(row.id ?? '');
    if (!sourceId) continue;

    const submitters = normalizeParticipantNames(row.submitter);
    const submitterSet = new Set(submitters);
    const members = normalizeParticipantNames(row.team_members ?? row.teamMembers)
      .filter((name) => !submitterSet.has(name));

    for (const participantName of submitters) {
      events.push({
        sourceId,
        participantName,
        reason: 'competition_submitter',
        points: 50,
      });
    }

    for (const participantName of members) {
      events.push({
        sourceId,
        participantName,
        reason: 'competition_member',
        points: 25,
      });
    }
  }

  return events;
}

export function buildPublishedCasePointEvents(rows: PublishedCaseRow[]): ContributionPointEvent[] {
  return buildPublishedContributionPointEvents(rows, 'case_published', CASE_PUBLISHED_POINTS);
}

export function buildPublishedResourcePointEvents(rows: PublishedResourceRow[]): ContributionPointEvent[] {
  return buildPublishedContributionPointEvents(rows, 'resource_published', RESOURCE_PUBLISHED_POINTS);
}

function buildPublishedContributionPointEvents(
  rows: Array<{ id: unknown; author_id?: unknown; status?: unknown }>,
  reason: ContributionPointReason,
  points: number,
): ContributionPointEvent[] {
  return rows.flatMap((row) => {
    const sourceId = typeof row.id === 'string' ? row.id : String(row.id ?? '');
    const userId = typeof row.author_id === 'string' ? row.author_id : String(row.author_id ?? '');
    if (!sourceId || !userId || row.status !== 'published') return [];

    return [{ sourceId, userId, reason, points }];
  });
}
