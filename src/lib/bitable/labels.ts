/**
 * 飞书字段用户可见标签的单一来源。
 *
 * 同一 dataIndex / 同一语义在不同页面必须使用同一个中文标签。
 */

export const FIELD_LABELS = {
  title: '名称',
  proposalNo: '场景编号',
  briefIntro: '一句话简介',
  sceneCategory: '场景分类',
  landingProgress: '落地进展',
  competitionProgress: '大赛进展',
  team: '提报团队',
  monthlySavedHours: '月均提效节省工时',
  monthlySavedCost: '月均降本费用',
  costSavedHours: '月均降本折算工时',
  totalSavedHours: '月均节省总工时',
  totalMonthlySavedHours: '月均节省总工时',
  totalEfficiencyRate: '总降本提效比例',
  efficiencyRate: '总降本提效比例',
  aiCost: '月均Token费用',
  finalValueScore: '最终价值计分',
  valueRank: '价值排名',
  reuseValue: '推广复用价值系数',
  reuseValueLevel: '推广复用价值等级',
  regionCoefficient: '场景归属地区系数',
} as const;

export const VALUE_FORMULA_COPY = {
  monthlySavedHours: '= 原月均耗时 - 新月均耗时',
  costSavedHours: '= 月均降本费用 / (50 x 场景归属地区系数值)',
  totalSavedHours: '= 月均提效节省工时 + 月均降本折算工时',
  finalValueScore: '= 月均节省总工时 x 归属地区人力成本系数 x 复用价值系数',
} as const;
