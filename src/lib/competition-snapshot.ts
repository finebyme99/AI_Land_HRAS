import type { WishItem } from '../components/DetailListBlock';

export const COMPETITION_SNAPSHOT_SELECT = [
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
  'period',
  'synced_at',
].join(', ');

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
  period?: string | null;
}

export type CompetitionSnapshotUpsertRow = Record<string, unknown> & {
  id: string;
  title: string;
  period: string;
};

export interface FeishuSnapshotRecord {
  record_id: string;
  fields?: Record<string, unknown>;
}

export function getCanonicalCompetitionSnapshotId(record: FeishuSnapshotRecord): string {
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
  return record.record_id;
}

export function getCompetitionSnapshotDuplicateShadowIds(records: FeishuSnapshotRecord[]): string[] {
  const canonicalIds = new Set<string>();
  const shadowIds = new Set<string>();

  for (const record of records) {
    const canonicalId = getCanonicalCompetitionSnapshotId(record);
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

export function mapCompetitionSnapshotRowToWishItem(row: CompetitionSnapshotRow): WishItem {
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
    period: item.reviewPeriod ?? '',
  };
}
