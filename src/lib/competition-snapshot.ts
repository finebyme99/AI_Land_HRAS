import type { WishItem } from '../components/DetailListBlock';
import type { PersonProfile } from './person-profile';

const COMPETITION_SNAPSHOT_BASE_COLUMNS = [
  'id',
  'record_url',
  'title',
  'submitter',
  'team_members',
  'team',
  'track',
  'scene_category',
  'ai_tools',
  'efficiency_rate',
  'monthly_saved_hours',
  'before_process',
  'pain_points',
  'after_process',
  'before_people_count',
  'after_people_count',
  'ai_cost',
  'extra_value',
  'verifier',
  'status',
  'proposal_no',
  'implementation',
  'new_operation_count',
  'old_operation_count',
  'team_type',
  'old_hours_per_task',
  'new_duration',
  'old_people_count',
  'new_people_count',
  'old_frequency',
  'new_frequency',
  'reuse_value',
  'reuse_value_level',
  'monthly_saved_cost',
  'cost_reduction_note',
  'implementation_link',
  'final_value_score',
  'brief_intro',
  'before_freq',
  'after_freq',
  'before_monthly_hours',
  'after_monthly_hours',
  'scene_region_coefficient_value',
  'monthly_cost_saving_hours',
  'total_monthly_saved_hours',
  'reuse_value_coefficient',
  'region_coefficient',
  'scene_source',
  'landing_progress',
  'progress_record',
  'planned_start_date',
  'pilot_date',
  'rollout_date',
  'full_launch_date',
  'biz_owner',
  'ai_owner',
  'period',
  'synced_at',
];

export const COMPETITION_SNAPSHOT_OWNER_PROFILE_COLUMNS = [
  'biz_owner_profiles',
  'ai_owner_profiles',
] as const;

export const COMPETITION_SNAPSHOT_SELECT = [
  ...COMPETITION_SNAPSHOT_BASE_COLUMNS.slice(0, -2),
  ...COMPETITION_SNAPSHOT_OWNER_PROFILE_COLUMNS,
  ...COMPETITION_SNAPSHOT_BASE_COLUMNS.slice(-2),
].join(', ');

export const COMPETITION_SNAPSHOT_SELECT_WITHOUT_OWNER_PROFILES = COMPETITION_SNAPSHOT_BASE_COLUMNS.join(', ');

export interface CompetitionSnapshotRow {
  id: string;
  record_url?: string | null;
  title?: string | null;
  submitter?: string[] | string | null;
  team_members?: string[] | string | null;
  team?: string[] | string | null;
  track?: string | null;
  scene_category?: string | null;
  ai_tools?: string[] | string | null;
  efficiency_rate?: number | string | null;
  monthly_saved_hours?: number | string | null;
  before_process?: string | null;
  pain_points?: string[] | string | null;
  after_process?: string | null;
  before_people_count?: number | string | null;
  after_people_count?: number | string | null;
  ai_cost?: number | string | null;
  extra_value?: string | null;
  verifier?: string[] | string | null;
  status?: string | null;
  proposal_no?: number | string | null;
  implementation?: string | null;
  new_operation_count?: number | string | null;
  old_operation_count?: number | string | null;
  team_type?: string | null;
  old_hours_per_task?: number | string | null;
  new_duration?: number | string | null;
  old_people_count?: number | string | null;
  new_people_count?: number | string | null;
  old_frequency?: string | null;
  new_frequency?: string | null;
  reuse_value?: string | null;
  reuse_value_level?: string | null;
  monthly_saved_cost?: number | string | null;
  cost_reduction_note?: string | null;
  implementation_link?: string | null;
  final_value_score?: number | string | null;
  brief_intro?: string | null;
  before_freq?: number | string | null;
  after_freq?: number | string | null;
  before_monthly_hours?: number | string | null;
  after_monthly_hours?: number | string | null;
  scene_region_coefficient_value?: number | string | null;
  monthly_cost_saving_hours?: number | string | null;
  total_monthly_saved_hours?: number | string | null;
  reuse_value_coefficient?: number | string | null;
  region_coefficient?: string | null;
  scene_source?: string | null;
  landing_progress?: string | null;
  progress_record?: string | null;
  planned_start_date?: string | null;
  pilot_date?: string | null;
  rollout_date?: string | null;
  full_launch_date?: string | null;
  biz_owner?: string[] | string | null;
  ai_owner?: string[] | string | null;
  biz_owner_profiles?: unknown;
  ai_owner_profiles?: unknown;
  period?: string | null;
  synced_at?: string | null;
}

export type CompetitionSnapshotUpsertRow = Record<string, unknown> & {
  id: string;
  title: string;
  period: string;
};

export function isMissingCompetitionOwnerProfileColumnsError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const message = error.message ?? '';
  const mentionsProfileColumn = COMPETITION_SNAPSHOT_OWNER_PROFILE_COLUMNS.some((column) => message.includes(column));
  return mentionsProfileColumn && (
    error.code === '42703'
    || error.code === 'PGRST204'
    || message.includes('does not exist')
    || message.includes('Could not find')
  );
}

export function omitCompetitionOwnerProfileColumns<T extends Record<string, unknown>>(row: T): T {
  const next = { ...row };
  for (const column of COMPETITION_SNAPSHOT_OWNER_PROFILE_COLUMNS) {
    delete next[column];
  }
  return next;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    if (key === 'synced_at') continue;
    result[key] = stableValue((value as Record<string, unknown>)[key]);
  }
  return result;
}

export function countChangedCompetitionSnapshotRows(
  nextRows: Array<Record<string, unknown> & { id: string }>,
  existingRows: Array<Record<string, unknown> & { id: string }>,
): number {
  const existingById = new Map(existingRows.map((row) => [row.id, JSON.stringify(stableValue(row))]));

  return nextRows.reduce((count, row) => {
    const existing = existingById.get(row.id);
    if (!existing) return count + 1;
    return existing === JSON.stringify(stableValue(row)) ? count : count + 1;
  }, 0);
}

export interface FeishuSnapshotRecord {
  record_id: string;
  fields?: Record<string, unknown>;
}

export interface CompetitionSnapshotIdentityRow {
  id: string;
  record_url?: string | null;
}

export function extractCompetitionRecordIdFromUrl(recordUrl: string | null | undefined): string | null {
  if (!recordUrl) return null;
  try {
    const url = new URL(recordUrl);
    return url.searchParams.get('record');
  } catch {
    const match = recordUrl.match(/[?&]record=([^&#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }
}

export function getCanonicalCompetitionSnapshotId(
  record: FeishuSnapshotRecord,
  existingRows: CompetitionSnapshotIdentityRow[] = [],
): string {
  const linkedLegacy = record.fields?.['关联参赛项目'];
  if (Array.isArray(linkedLegacy) && linkedLegacy.length > 0) {
    const first = linkedLegacy[0];
    if (first && typeof first === 'object' && 'record_ids' in first) {
      const recordIds = (first as { record_ids?: unknown }).record_ids;
      if (Array.isArray(recordIds) && typeof recordIds[0] === 'string' && recordIds[0]) {
        return recordIds[0];
      }
    }
  }
  const existingAlias = existingRows.find((row) => row.id !== record.record_id && extractCompetitionRecordIdFromUrl(row.record_url) === record.record_id);
  if (existingAlias) return existingAlias.id;
  return record.record_id;
}

export function getCompetitionSnapshotDuplicateShadowIds(
  records: FeishuSnapshotRecord[],
  existingRows: CompetitionSnapshotIdentityRow[] = [],
): string[] {
  const canonicalIds = new Set<string>();
  const shadowIds = new Set<string>();

  for (const record of records) {
    const canonicalId = getCanonicalCompetitionSnapshotId(record, existingRows);
    canonicalIds.add(canonicalId);
    if (canonicalId !== record.record_id) {
      shadowIds.add(record.record_id);
    }
  }

  return [...shadowIds].filter((id) => !canonicalIds.has(id));
}

function asArray(value: string[] | string | null | undefined): string[] | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [String(value)] : undefined;
}

function asString(value: string[] | string | null | undefined): string | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) return value.filter(Boolean).join(' / ') || undefined;
  return value || undefined;
}

function asNumber(value: number | string | null | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/[,，¥￥\s]/g, '');
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dbArray(value: string[] | string | null | undefined): string[] | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [String(value)] : null;
}

function dbNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function personProfilesFromNames(values: string[] | string | null | undefined): PersonProfile[] {
  const names = Array.isArray(values) ? values : values ? [values] : [];
  return names
    .map((name) => String(name).trim())
    .filter(Boolean)
    .map((name) => ({ name }));
}

function cleanPersonProfile(profile: PersonProfile): PersonProfile {
  return Object.fromEntries(
    Object.entries(profile).filter(([, value]) => value !== undefined && value !== ''),
  ) as PersonProfile;
}

function asPersonProfiles(value: unknown, fallbackNames: string[] | undefined): PersonProfile[] | undefined {
  if (Array.isArray(value)) {
    const profiles = value
      .map<PersonProfile | null>((item) => {
        if (!item || typeof item !== 'object') return null;
        const record = item as Partial<PersonProfile>;
        if (!record.name || typeof record.name !== 'string') return null;
        return cleanPersonProfile({
          name: record.name,
          enName: record.enName,
          openId: record.openId,
          userId: record.userId,
          unionId: record.unionId,
          email: record.email,
          avatarUrl: record.avatarUrl,
          employeeId: record.employeeId,
          department: record.department,
          jobTitle: record.jobTitle,
        });
      })
      .filter((profile): profile is PersonProfile => profile !== null);
    if (profiles.length > 0) return profiles;
  }
  const fallback = personProfilesFromNames(fallbackNames);
  return fallback.length > 0 ? fallback : undefined;
}

function dbPersonProfiles(profiles: PersonProfile[] | undefined, fallbackNames: string[] | string | null | undefined): PersonProfile[] {
  if (profiles && profiles.length > 0) return profiles;
  return personProfilesFromNames(fallbackNames);
}

export function mapCompetitionSnapshotRowToWishItem(row: CompetitionSnapshotRow): WishItem {
  const bizOwner = asArray(row.biz_owner);
  const aiOwner = asArray(row.ai_owner);

  return {
    id: row.id,
    recordUrl: row.record_url ?? undefined,
    proposalNo: row.proposal_no == null ? undefined : String(row.proposal_no),
    title: row.title ?? undefined,
    briefIntro: row.brief_intro ?? undefined,
    sceneCategory: row.scene_category ?? undefined,
    coreValue: row.extra_value ?? undefined,
    sceneSource: row.scene_source ?? undefined,
    regionCoefficient: row.region_coefficient ?? undefined,
    regionCoefficientValue: asNumber(row.scene_region_coefficient_value),
    landingProgress: row.landing_progress ?? undefined,
    progressRecord: row.progress_record ?? undefined,
    plannedStartDate: row.planned_start_date ?? undefined,
    pilotDate: row.pilot_date ?? undefined,
    rolloutDate: row.rollout_date ?? undefined,
    fullLaunchDate: row.full_launch_date ?? undefined,
    bizOwner,
    aiOwner,
    bizOwnerProfiles: asPersonProfiles(row.biz_owner_profiles, bizOwner),
    aiOwnerProfiles: asPersonProfiles(row.ai_owner_profiles, aiOwner),
    competitionProgress: row.status ?? undefined,
    reviewPeriod: row.period ?? undefined,
    submitter: asArray(row.submitter),
    teamMembers: asArray(row.team_members),
    team: asString(row.team),
    teamType: row.team_type ?? undefined,
    aiTools: asArray(row.ai_tools),
    beforeProcess: row.before_process ?? undefined,
    painPoints: asArray(row.pain_points),
    beforeFrequency: row.old_frequency ?? undefined,
    beforeOperationCount: asNumber(row.old_operation_count),
    beforeFreq: row.before_freq == null ? undefined : String(row.before_freq),
    beforePeopleCount: asNumber(row.before_people_count),
    beforeHoursPerTask: asNumber(row.old_hours_per_task),
    beforeMonthlyHours: asNumber(row.before_monthly_hours),
    monthlySavedHours: asNumber(row.monthly_saved_hours),
    monthlySavedCost: asNumber(row.monthly_saved_cost),
    costReductionNote: row.cost_reduction_note ?? undefined,
    costSavedHours: asNumber(row.monthly_cost_saving_hours),
    totalSavedHours: asNumber(row.total_monthly_saved_hours),
    afterProcess: row.after_process ?? undefined,
    afterFrequency: row.new_frequency ?? undefined,
    afterOperationCount: asNumber(row.new_operation_count),
    afterFreq: row.after_freq == null ? undefined : String(row.after_freq),
    afterPeopleCount: asNumber(row.after_people_count),
    afterHoursPerTask: asNumber(row.new_duration),
    afterMonthlyHours: asNumber(row.after_monthly_hours),
    aiCost: asNumber(row.ai_cost),
    reuseValue: row.reuse_value ?? undefined,
    reuseValueNumber: asNumber(row.reuse_value_coefficient),
    reuseValueLevel: row.reuse_value_level ?? undefined,
    totalEfficiencyRate: asNumber(row.efficiency_rate),
    finalValueScore: asNumber(row.final_value_score),
    implementation: row.implementation ?? undefined,
    implementationLink: row.implementation_link ?? undefined,
  };
}

export function buildCompetitionSnapshotUpsertRow(item: WishItem): CompetitionSnapshotUpsertRow {
  return {
    id: item.id,
    record_url: item.recordUrl ?? null,
    title: item.title ?? '',
    submitter: dbArray(item.submitter),
    team_members: dbArray(item.teamMembers),
    team: dbArray(item.team),
    track: null,
    scene_category: item.sceneCategory ?? null,
    ai_tools: dbArray(item.aiTools),
    efficiency_rate: dbNumber(item.totalEfficiencyRate),
    monthly_saved_hours: dbNumber(item.monthlySavedHours),
    before_process: item.beforeProcess ?? null,
    pain_points: dbArray(item.painPoints),
    after_process: item.afterProcess ?? null,
    before_people_count: dbNumber(item.beforePeopleCount),
    after_people_count: dbNumber(item.afterPeopleCount),
    ai_cost: dbNumber(item.aiCost),
    extra_value: item.coreValue ?? null,
    verifier: null,
    status: item.competitionProgress ?? null,
    synced_at: new Date().toISOString(),
    implementation: item.implementation ?? null,
    new_operation_count: dbNumber(item.afterOperationCount),
    old_operation_count: dbNumber(item.beforeOperationCount),
    team_type: item.teamType ?? null,
    old_hours_per_task: dbNumber(item.beforeHoursPerTask),
    new_duration: dbNumber(item.afterHoursPerTask),
    old_frequency: item.beforeFrequency ?? null,
    new_frequency: item.afterFrequency ?? null,
    reuse_value: item.reuseValue ?? null,
    reuse_value_level: item.reuseValueLevel ?? null,
    monthly_saved_cost: dbNumber(item.monthlySavedCost),
    cost_reduction_note: item.costReductionNote ?? null,
    implementation_link: item.implementationLink ?? null,
    final_value_score: dbNumber(item.finalValueScore),
    brief_intro: item.briefIntro ?? null,
    before_freq: dbNumber(asNumber(item.beforeFreq)),
    after_freq: dbNumber(asNumber(item.afterFreq)),
    before_monthly_hours: dbNumber(item.beforeMonthlyHours),
    after_monthly_hours: dbNumber(item.afterMonthlyHours),
    scene_region_coefficient_value: dbNumber(item.regionCoefficientValue),
    monthly_cost_saving_hours: dbNumber(item.costSavedHours),
    total_monthly_saved_hours: dbNumber(item.totalSavedHours),
    reuse_value_coefficient: dbNumber(item.reuseValueNumber),
    region_coefficient: item.regionCoefficient ?? null,
    scene_source: item.sceneSource ?? null,
    landing_progress: item.landingProgress ?? null,
    progress_record: item.progressRecord ?? null,
    planned_start_date: item.plannedStartDate ?? null,
    pilot_date: item.pilotDate ?? null,
    rollout_date: item.rolloutDate ?? null,
    full_launch_date: item.fullLaunchDate ?? null,
    biz_owner: dbArray(item.bizOwner),
    ai_owner: dbArray(item.aiOwner),
    biz_owner_profiles: dbPersonProfiles(item.bizOwnerProfiles, item.bizOwner),
    ai_owner_profiles: dbPersonProfiles(item.aiOwnerProfiles, item.aiOwner),
    period: item.reviewPeriod ?? '',
  };
}
