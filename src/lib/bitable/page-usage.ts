/**
 * 飞书字段 → 前端页面消费映射
 *
 * 跟 bitable_field_map.roles（后端 API 消费）不同，这里是**前端页面渲染层**消费。
 * 改这张表 = 改 ChoDashboard / wish-pool 页面渲染哪些字段时同步更新此处，
 * admin UI 在 /admin/bitable-field-map 用它打对钩。
 *
 * 设计原则：
 * - 单文件聚合所有"前端页面 key 集合"，便于 review
 * - PAGE_LABELS 是 admin 表格列头 + 三个页面标题的**唯一来源**（保证视觉一致）
 * - key 集合是粗判（出现就勾），不深究渲染细节（不区分主表格 vs 弹窗）
 */

export type PageKey = 'choDashboard' | 'wishPool' | 'wishPoolCard';

/** 三个消费页面的展示标签（admin 表格表头 + 三个页面标题共用，**禁止改名只改一处**） */
export const PAGE_LABELS: Record<PageKey, string> = {
  choDashboard: '成效看板',
  wishPool: '场景池',
  wishPoolCard: '场景池卡片',
};

/** 成效看板（/competitions 页面 → ChoDashboard 组件）的明细表用到的字段 key */
const CHO_DASHBOARD_KEYS: ReadonlySet<string> = new Set([
  // 基础信息
  'title',           // 场景名称 → 「名称」列
  'team',            // 提报团队 → 标题下方副文本
  'sceneCategory',   // 场景分类
  'aiTools',         // AI 工具
  'beforeProcess',   // 原业务流程
  'afterProcess',    // 新业务流程
  // 改造前后对比（频次/耗时/人数/月工时 四列）
  'oldFrequency', 'newFrequency',                      // 原/新操作频率
  'oldOperationCount', 'newOperationCount',            // 原/新操作次数（计算频次）
  'oldHoursPerTask', 'newDuration',                     // 原/新单次操作耗时
  'beforePeopleCount', 'afterPeopleCount',              // 原/新操作人数
  'beforeFreq', 'afterFreq',                            // 原/新操作频次（飞书公式）
  'beforeMonthlyHours', 'afterMonthlyHours',            // 原/新月均耗时
  // 改造成效
  'totalMonthlySavedHours',                             // 月均节省总工时
  'monthlyCostSavingHours',                             // 月均降本折算工时
  'monthlySavedCost',                                   // 月均降本费用
  'costReductionNote',                                  // 降本费用说明
  // 复用价值
  'reuseValue',                                         // 推广复用价值系数
  'reuseValueLevel',                                    // 推广复用价值等级
  'sceneRegionCoefficientValue',                        // 场景归属地区系数值
  // 最终价值计分
  'finalValueScore',
  // 月均 Token 费用（间接参与月均节省总工时公式）
  'aiCost',
  // 一句话简介（点击标题进弹窗）
  'briefIntro',
]);

/** 场景池（/wish-pool 页面主表格 + 详情弹窗 SceneDrillDownModal）用到的字段 key */
const WISH_POOL_KEYS: ReadonlySet<string> = new Set([
  // 头部 Tag
  'proposalNo', 'sceneCategory', 'landingProgress', 'reuseValueLevel',
  // 标题 / 简介
  'title', 'briefIntro',
  // 场景信息
  'coreValue', 'sceneSource', 'bizOwner', 'aiOwner',
  'team', 'teamType', 'submitter', 'teamMembers', 'aiTools',
  'plannedStartDate', 'pilotDate', 'rolloutDate', 'fullLaunchDate',
  // AI 前指标
  'beforeProcess', 'painPoints',
  'beforeFrequency', 'beforeOperationCount', 'beforeFreq', 'beforePeopleCount',
  'beforeHoursPerTask', 'beforeMonthlyHours',
  // AI 后指标
  'afterProcess',
  'afterFrequency', 'afterOperationCount', 'afterFreq', 'afterPeopleCount',
  'afterHoursPerTask', 'afterMonthlyHours',
  'aiCost',
  // 价值计分
  'monthlySavedHours', 'monthlySavedCost', 'costReductionNote',
  'costSavedHours', 'totalSavedHours', 'totalEfficiencyRate',
  'regionCoefficient',
  'reuseValue', 'valueRank', 'finalValueScore',
  // 实现
  'implementation', 'implementationLink',
  // 进展记录
  'progressRecord',
  // 链接
  'recordUrl',
]);

/** 场景池卡片（鼠标悬浮图表柱状条弹出的 SceneHoverList，6 列）用到的字段 key */
const WISH_POOL_CARD_KEYS: ReadonlySet<string> = new Set([
  'title',                 // 场景
  'team',                  // 提报团队
  'landingProgress',       // 落地进展
  'totalSavedHours',       // 月均节省总工时
  'monthlySavedHours',     // 月均节省总工时（fallback）
  'reuseValueLevel',       // 复用价值
  'regionCoefficient',     // 地区
]);

/** 字段 key → 该字段被哪些页面消费 */
export const PAGE_USAGE: Record<PageKey, ReadonlySet<string>> = {
  choDashboard: CHO_DASHBOARD_KEYS,
  wishPool: WISH_POOL_KEYS,
  wishPoolCard: WISH_POOL_CARD_KEYS,
};

/** 工具：判断某 key 是否被某页面消费 */
export function isUsedByPage(key: string, page: PageKey): boolean {
  return PAGE_USAGE[page].has(key);
}
