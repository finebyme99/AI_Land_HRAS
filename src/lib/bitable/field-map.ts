/**
 * 飞书多维表格字段映射 — 单一源
 *
 * 历史：sync / progress / wish-pool 三个 API 各维护一份硬编码字段映射，新加字段要改三处。
 * 现在统一到 FALLBACK_FIELD_MAP，DB 表 bitable_field_map 部署后可读 DB 优先，DB 不可用时 fallback。
 *
 * 命名约定：
 * - 飞书字段名（key of FALLBACK_FIELD_MAP）始终是中文原始名
 * - 前端 camelCase key（`FALLBACK_FIELD_MAP[name].key`）是所有消费方共享的"标准名"
 * - sync 的 DB 列名独立维护在 SYNC_KEY_TO_DB（schema 决定，跨项目不可变）
 */

export type FieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'person'
  | 'formula'
  | 'date'
  | 'url';

/** select/multi_select 字段的选项（来自飞书 property.options） */
export interface FieldSelectOption {
  id: string;      // 飞书选项 ID (如 "optXXXX")
  name: string;    // 选项显示文本 (如 "数据分析")
  color?: number;  // 飞书颜色编号（可选）
}

export interface FieldMapEntry {
  /** 前端 camelCase key，sync / progress / wish-pool 三处共用 */
  key: string;
  type: FieldType;
  /** 飞书编组：场景信息 / 大赛相关 / 落地进展 / AI前指标 / AI后指标 / 价值计分 / 实现 */
  group: string;
  /** 飞书字段注释（来自 bitable_field_map.description），可能为空 */
  description?: string;
  /** select/multi_select 字段的选项列表（来自 bitable_field_map.options），非 select 字段为 undefined */
  options?: FieldSelectOption[];
}

/** 飞书字段名 → 前端字段定义 */
export const FALLBACK_FIELD_MAP: Record<string, FieldMapEntry> = {
  // ── 场景信息 ──
  '场景编号':                 { key: 'proposalNo', type: 'text', group: '场景信息' },
  '场景名称':                 { key: 'title', type: 'text', group: '场景信息' },
  '一句话简介':               { key: 'briefIntro', type: 'text', group: '场景信息' },
  '场景分类':                 { key: 'sceneCategory', type: 'select', group: '场景信息' },
  '核心价值':                 { key: 'coreValue', type: 'select', group: '场景信息' },
  '场景来源':                 { key: 'sceneSource', type: 'select', group: '场景信息' },
  '业务负责人':               { key: 'bizOwner', type: 'person', group: '场景信息' },
  'AI负责人':                { key: 'aiOwner', type: 'person', group: '场景信息' },

  // ── 大赛相关 ──
  '大赛进展':                 { key: 'competitionProgress', type: 'select', group: '大赛相关' },
  '评审周期':                 { key: 'reviewPeriod', type: 'text', group: '大赛相关' },
  '提报人':                   { key: 'submitter', type: 'person', group: '大赛相关' },
  '组队成员':                 { key: 'teamMembers', type: 'person', group: '大赛相关' },
  '创建人':                   { key: 'creator', type: 'person', group: '大赛相关' },
  '提报团队':                 { key: 'team', type: 'select', group: '大赛相关' },
  '提报组队类型':             { key: 'teamType', type: 'select', group: '大赛相关' },
  'AI工具':                  { key: 'aiTools', type: 'multi_select', group: '大赛相关' },

  // ── 落地进展 ──
  '落地进展':                 { key: 'landingProgress', type: 'select', group: '落地进展' },
  '计划启动日期':             { key: 'plannedStartDate', type: 'date', group: '落地进展' },
  '试点上线日期':             { key: 'pilotDate', type: 'date', group: '落地进展' },
  '推广上线日期':             { key: 'rolloutDate', type: 'date', group: '落地进展' },
  '全面上线日期':             { key: 'fullLaunchDate', type: 'date', group: '落地进展' },
  '进展记录&链接':            { key: 'progressRecord', type: 'text', group: '落地进展' },

  // ── AI 前指标 ──
  '原业务场景及流程':         { key: 'beforeProcess', type: 'text', group: 'AI前指标' },
  '原核心痛点':               { key: 'painPoints', type: 'multi_select', group: 'AI前指标' },
  '原操作频率':               { key: 'beforeFrequency', type: 'select', group: 'AI前指标' },
  '原操作次数':               { key: 'beforeOperationCount', type: 'number', group: 'AI前指标' },
  '原操作频次':               { key: 'beforeFreq', type: 'text', group: 'AI前指标' },
  '原操作人数':               { key: 'beforePeopleCount', type: 'number', group: 'AI前指标' },
  '原人均单次操作耗时':           { key: 'beforeHoursPerTask', type: 'number', group: 'AI前指标' },
  '原月均耗时':               { key: 'beforeMonthlyHours', type: 'formula', group: 'AI前指标' },

  // ── AI 后指标 ──
  '新业务流程':               { key: 'afterProcess', type: 'text', group: 'AI后指标' },
  '新操作频率':               { key: 'afterFrequency', type: 'select', group: 'AI后指标' },
  '新操作次数':               { key: 'afterOperationCount', type: 'number', group: 'AI后指标' },
  '新操作频次':               { key: 'afterFreq', type: 'text', group: 'AI后指标' },
  '新操作人数':               { key: 'afterPeopleCount', type: 'number', group: 'AI后指标' },
  '新人均单次操作耗时':           { key: 'afterHoursPerTask', type: 'number', group: 'AI后指标' },
  '新月均耗时':               { key: 'afterMonthlyHours', type: 'formula', group: 'AI后指标' },
  '月均Token费用':            { key: 'aiCost', type: 'number', group: 'AI后指标' },

  // ── 价值计分 ──
  '月均提效节省工时':         { key: 'monthlySavedHours', type: 'formula', group: '价值计分' },
  '月均降本费用（不含人力成本）': { key: 'monthlySavedCost', type: 'number', group: '价值计分' },
  '降本费用说明':             { key: 'costReductionNote', type: 'text', group: '价值计分' },
  '月均降本折算工时':         { key: 'costSavedHours', type: 'formula', group: '价值计分' },
  '月均节省总工时':           { key: 'totalSavedHours', type: 'formula', group: '价值计分' },
  '总降本提效比例':           { key: 'totalEfficiencyRate', type: 'formula', group: '价值计分' },
  '场景归属地区系数':         { key: 'regionCoefficient', type: 'select', group: '价值计分' },
  '场景归属地区系数值':       { key: 'regionCoefficientValue', type: 'number', group: '价值计分' },
  '推广复用价值系数':         { key: 'reuseValue', type: 'select', group: '价值计分' },
  '推广复用价值系数值':       { key: 'reuseValueNumber', type: 'number', group: '价值计分' },
  '推广复用价值等级':         { key: 'reuseValueLevel', type: 'select', group: '价值计分' },
  '最终价值计分':             { key: 'finalValueScore', type: 'formula', group: '价值计分' },
  '价值排名':                 { key: 'valueRank', type: 'formula', group: '价值计分' },

  // ── 实现 ──
  'AI实现过程简述':           { key: 'implementation', type: 'text', group: '实现' },
  'AI实现效果':               { key: 'implementationLink', type: 'url', group: '实现' },
};

/** 反向索引：前端 key → 飞书字段名（用于 sync 等需要按 key 反查的场景） */
export const KEY_TO_FEISHU_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(FALLBACK_FIELD_MAP).map(([name, entry]) => [entry.key, name]),
);

/** sync 专用：前端 camelCase key → Supabase snake_case 列名
 *  注意：这是 schema 决定，不在共享映射里。如果 DB 列名改了，这里也要改。
 *  如果这里没列出的 key，sync 写入时会自动用 snake_case 转换（toSnakeCase）。 */
export const SYNC_KEY_TO_DB: Record<string, string> = {
  proposalNo: 'proposal_no',
  title: 'title',
  briefIntro: 'brief_intro',
  sceneCategory: 'scene_category',
  sceneSource: 'scene_source',
  coreValue: 'extra_value',           // 注意：DB 列名是 extra_value
  submitter: 'submitter',
  teamMembers: 'team_members',
  team: 'team',
  teamType: 'team_type',
  aiTools: 'ai_tools',
  reviewPeriod: 'period',             // 注意：DB 列名是 period
  competitionProgress: 'status',      // 注意：DB 列名是 status
  landingProgress: 'landing_progress',
  beforeProcess: 'before_process',
  painPoints: 'pain_points',
  beforeOperationCount: 'old_operation_count', // 注意：DB 列名是 old_operation_count
  afterOperationCount: 'new_operation_count',
  beforeHoursPerTask: 'old_hours_per_task',
  afterHoursPerTask: 'new_duration', // 注意：DB 列名是 new_duration
  beforePeopleCount: 'before_people_count',
  afterPeopleCount: 'after_people_count',
  beforeFrequency: 'old_frequency',
  afterFrequency: 'new_frequency',
  aiCost: 'ai_cost',
  monthlySavedHours: 'monthly_saved_hours',
  monthlySavedCost: 'monthly_saved_cost',
  costReductionNote: 'cost_reduction_note',
  costSavedHours: 'monthly_cost_saving_hours', // 注意：DB 列名跟前端 key 不一致
  totalSavedHours: 'total_monthly_saved_hours', // 注意
  totalEfficiencyRate: 'efficiency_rate',       // 注意
  regionCoefficient: 'region_coefficient',
  regionCoefficientValue: 'scene_region_coefficient_value', // 注意
  reuseValue: 'reuse_value',
  reuseValueNumber: 'reuse_value_coefficient', // 注意
  reuseValueLevel: 'reuse_value_level',
  finalValueScore: 'final_value_score',
  implementation: 'implementation',
  implementationLink: 'implementation_link',
  beforeFreq: 'before_freq',
  afterFreq: 'after_freq',
  beforeMonthlyHours: 'before_monthly_hours',
  afterMonthlyHours: 'after_monthly_hours',
};

/** camelCase → snake_case（自动转换，未在 SYNC_KEY_TO_DB 列出的字段） */
export function toSnakeCase(s: string): string {
  return s.replace(/([A-Z])/g, '_$1').toLowerCase();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractValue(value: any, type: FieldType): unknown {
  if (value == null) return null;

  switch (type) {
    case 'text':
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) return value.map((v: { text?: string }) => v.text ?? '').join('');
      return String(value);

    case 'number':
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return Number(value) || null;
      return null;

    case 'formula':
      // 飞书公式字段返回值类型不固定：可能是 number、string、或 [{text}] 数组
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return Number(value) || null;
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0];
        if (typeof first === 'object' && first !== null && 'text' in first) return Number(first.text) || null;
        return Number(first) || null;
      }
      return null;

    case 'select':
      if (typeof value === 'string') return value;
      if (typeof value !== null && typeof value === 'object' && 'text' in value) return (value as { text: string }).text;
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0];
        if (typeof first === 'object' && first !== null && 'text' in first) return (first as { text: string }).text;
        return String(first);
      }
      return null;

    case 'multi_select':
      if (Array.isArray(value)) {
        return value.map((v: unknown) => {
          if (typeof v === 'string') return v;
          if (typeof v === 'object' && v !== null && 'text' in v) return (v as { text: string }).text;
          return String(v);
        });
      }
      if (typeof value === 'string') return [value];
      return [];

    case 'person':
      if (Array.isArray(value)) {
        return value.map((v: { name?: string; id?: string }) => v.name ?? v.id ?? '');
      }
      if (typeof value === 'object' && value !== null) {
        return [((value as { name?: string; id?: string }).name) ?? (value as { id?: string }).id ?? ''];
      }
      return [];

    case 'date':
      if (typeof value === 'number') return new Date(value).toISOString();
      if (typeof value === 'string') return value;
      return null;

    case 'url':
      if (typeof value === 'object' && value !== null && 'link' in value) return (value as { link: string }).link;
      if (typeof value === 'string') return value;
      return null;
  }
}

/** 把飞书 record.fields 映射成统一的前端字段对象 */
export function mapFeishuRecord(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: { record_id: string; fields?: Record<string, any> },
  wikiUrlBuilder: (recordId: string) => string,
  /** 可选：用 DB 映射替换 FALLBACK_FIELD_MAP（未来 UI 配置后启用） */
  overrideMap?: Record<string, FieldMapEntry>,
): Record<string, unknown> {
  const map = overrideMap ?? FALLBACK_FIELD_MAP;
  const out: Record<string, unknown> = {
    id: record.record_id,
    recordUrl: wikiUrlBuilder(record.record_id),
  };
  for (const [fieldName, value] of Object.entries(record.fields ?? {})) {
    const entry = map[fieldName];
    if (!entry) continue;
    out[entry.key] = extractValue(value, entry.type);
  }
  return out;
}