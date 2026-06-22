import type { FieldSelectOption } from '@/lib/bitable/field-map';

const EXCLUDED_DEPARTMENT_NAMES = new Set(['未填写', '']);

export function normalizeDepartmentValues(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of values) {
    const value = raw?.trim() ?? '';
    if (EXCLUDED_DEPARTMENT_NAMES.has(value) || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

export function normalizeDepartmentInput(value: unknown): string[] {
  if (Array.isArray(value)) {
    return normalizeDepartmentValues(
      value.filter((item): item is string | null | undefined => typeof item === 'string' || item == null),
    );
  }

  if (typeof value === 'string') return normalizeDepartmentValues([value]);

  return [];
}

export function hasDepartmentSelection(value: unknown): boolean {
  return normalizeDepartmentInput(value).length > 0;
}

export function isAllDepartmentsSelected(
  selectedDepartments: Array<string | null | undefined>,
  allDepartments: Array<string | null | undefined>,
): boolean {
  const selected = new Set(normalizeDepartmentValues(selectedDepartments));
  const all = normalizeDepartmentValues(allDepartments);

  if (all.length === 0) return false;

  return all.every((department) => selected.has(department));
}

export function getDepartmentDisplayValues(
  selectedDepartments: Array<string | null | undefined>,
  allDepartments: Array<string | null | undefined>,
): string[] {
  const selected = normalizeDepartmentValues(selectedDepartments);
  if (selected.length === 0) return [];

  return isAllDepartmentsSelected(selected, allDepartments) ? ['全部'] : selected;
}

export function buildDepartmentOptions(
  fieldOptions: FieldSelectOption[] | undefined,
  fallbackTeams: string[][] = [],
): string[] {
  return normalizeDepartmentValues([
    ...(fieldOptions ?? []).map((option) => option.name),
    ...fallbackTeams.flat(),
  ]);
}
