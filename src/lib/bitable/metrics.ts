import type { FieldMapEntry, FieldSelectOption } from '@/lib/bitable/field-map';

export const EXCLUDED_BITABLE_OPTION_NAME = '数据补充中';
export const EXCLUDED_BITABLE_OPTION_KEYS = ['landingProgress', 'competitionProgress'] as const;

export interface ValueMetricSummary {
  count: number;
  totalPeople: number;
  totalSavedEfficiency: number;
  totalMonthlySavedCost: number;
  totalMonthlySavedCostDisplay: string;
  totalMonthlySavedHoursSum: number;
}

function getRecordValue(item: object, key: string): unknown {
  return (item as Record<string, unknown>)[key];
}

export function parseMetricNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;

  const normalized = value.replace(/,/g, '');
  const num = parseFloat(normalized.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(num) ? num : null;
}

export function parsePositiveMetricNumber(value: unknown): number | null {
  const num = parseMetricNumber(value);
  return num != null && num > 0 ? num : null;
}

export function roundMetric(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function formatCurrency(value: unknown): string {
  const num = parsePositiveMetricNumber(value);
  if (num == null) return '—';
  return `¥${Math.round(num).toLocaleString('zh-CN')}`;
}

export function sumMetric<T extends object>(items: readonly T[], key: string): number {
  return items.reduce((sum, item) => sum + (parseMetricNumber(getRecordValue(item, key)) ?? 0), 0);
}

export function sumPositiveMetric<T extends object>(items: readonly T[], key: string): number {
  return items.reduce((sum, item) => sum + (parsePositiveMetricNumber(getRecordValue(item, key)) ?? 0), 0);
}

export function summarizeValueMetrics<T extends object>(
  items: readonly T[],
  keys: {
    peopleKey?: string;
    monthlySavedHoursKey?: string;
    monthlySavedCostKey?: string;
    totalSavedHoursKey?: string;
  } = {},
): ValueMetricSummary {
  const peopleKey = keys.peopleKey ?? 'beforePeopleCount';
  const monthlySavedHoursKey = keys.monthlySavedHoursKey ?? 'monthlySavedHours';
  const monthlySavedCostKey = keys.monthlySavedCostKey ?? 'monthlySavedCost';
  const totalSavedHoursKey = keys.totalSavedHoursKey ?? 'totalSavedHours';

  const totalPeople = Math.round(sumMetric(items, peopleKey));
  const totalSavedEfficiency = roundMetric(sumMetric(items, monthlySavedHoursKey));
  const totalMonthlySavedCost = sumPositiveMetric(items, monthlySavedCostKey);
  const totalMonthlySavedHoursSum = roundMetric(sumMetric(items, totalSavedHoursKey));

  return {
    count: items.length,
    totalPeople,
    totalSavedEfficiency,
    totalMonthlySavedCost,
    totalMonthlySavedCostDisplay: formatCurrency(totalMonthlySavedCost),
    totalMonthlySavedHoursSum,
  };
}

export function collectFieldDescriptions(fieldMap: Record<string, FieldMapEntry>): Record<string, string> {
  const fieldDescriptions: Record<string, string> = {};
  for (const entry of Object.values(fieldMap)) {
    if (entry.description) fieldDescriptions[entry.key] = entry.description;
  }
  return fieldDescriptions;
}

export function sanitizeFieldOptions<T extends { name: string }>(
  fieldOptions: Record<string, T[]>,
): Record<string, T[]> {
  const cleaned: Record<string, T[]> = { ...fieldOptions };
  for (const key of EXCLUDED_BITABLE_OPTION_KEYS) {
    if (cleaned[key]) {
      cleaned[key] = cleaned[key].filter((option) => option.name !== EXCLUDED_BITABLE_OPTION_NAME);
    }
  }
  return cleaned;
}

export function collectFieldOptions(fieldMap: Record<string, FieldMapEntry>): Record<string, FieldSelectOption[]> {
  const fieldOptions: Record<string, FieldSelectOption[]> = {};
  for (const entry of Object.values(fieldMap)) {
    if (entry.options && entry.options.length > 0) {
      fieldOptions[entry.key] = entry.options;
    }
  }
  return sanitizeFieldOptions(fieldOptions);
}

export function isExcludedBitableRecord(item: object): boolean {
  return EXCLUDED_BITABLE_OPTION_KEYS.some(
    (key) => getRecordValue(item, key) === EXCLUDED_BITABLE_OPTION_NAME,
  );
}

export function filterExcludedBitableRecords<T extends object>(items: readonly T[]): T[] {
  return items.filter((item) => !isExcludedBitableRecord(item));
}

export function assignValueStarLevels<T extends Record<string, unknown>>(
  items: T[],
  scoreKey = 'finalValueScore',
): T[] {
  const scored = items
    .filter((item) => (parseMetricNumber(item[scoreKey]) ?? 0) > 0)
    .sort((a, b) => (parseMetricNumber(b[scoreKey]) ?? 0) - (parseMetricNumber(a[scoreKey]) ?? 0));

  const total = scored.length;
  scored.forEach((item, idx) => {
    const writable = item as Record<string, unknown>;
    const percentile = (idx + 1) / total;
    if (percentile <= 0.2) writable['valueStarLevel'] = 5;
    else if (percentile <= 0.4) writable['valueStarLevel'] = 4;
    else if (percentile <= 0.6) writable['valueStarLevel'] = 3;
    else if (percentile <= 0.8) writable['valueStarLevel'] = 2;
    else writable['valueStarLevel'] = 1;
  });

  items
    .filter((item) => (parseMetricNumber(item[scoreKey]) ?? 0) <= 0)
    .forEach((item) => { (item as Record<string, unknown>)['valueStarLevel'] = null; });

  return items;
}
