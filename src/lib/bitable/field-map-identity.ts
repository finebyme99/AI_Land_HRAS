export type FieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'person'
  | 'formula'
  | 'date'
  | 'url';

export interface FieldSelectOption {
  id: string;
  name: string;
  color?: number;
}

export interface FallbackFieldMapEntry {
  key: string;
  type: FieldType;
  group: string;
}

export interface ExistingFieldMapRow {
  id: string;
  field_id: string | null;
  field_name: string;
  key: string;
  type: FieldType;
  group_name: string;
  is_active: boolean;
  roles: string[];
  sort_order: number;
}

export interface NormalizedFeishuField {
  field_id: string;
  field_name: string;
  group_name: string;
  description: string;
  options: FieldSelectOption[] | null;
}

export interface FieldMapSyncPlan {
  toInsert: Array<Record<string, unknown>>;
  toUpdate: Array<{
    id: string;
    field_id: string;
    field_name: string;
    group_name: string;
    description: string;
    options: FieldSelectOption[] | null;
  }>;
  skipped: number;
  fieldDescriptions: Record<string, string>;
  fieldOptions: Record<string, FieldSelectOption[]>;
}

interface FieldMapRowIndexes {
  byFieldId: Map<string, ExistingFieldMapRow>;
  byFieldName: Map<string, ExistingFieldMapRow>;
}

function isUnknownKey(key: string): boolean {
  return key.startsWith('unknown_');
}

function preferFieldIdRow(current: ExistingFieldMapRow, candidate: ExistingFieldMapRow): ExistingFieldMapRow {
  if (isUnknownKey(current.key) !== isUnknownKey(candidate.key)) {
    return isUnknownKey(current.key) ? candidate : current;
  }
  if (current.is_active !== candidate.is_active) {
    return candidate.is_active ? candidate : current;
  }
  return current;
}

export function indexFieldMapRows(rows: ExistingFieldMapRow[]): FieldMapRowIndexes {
  const byFieldId = new Map<string, ExistingFieldMapRow>();
  const byFieldName = new Map<string, ExistingFieldMapRow>();

  for (const row of rows) {
    byFieldName.set(row.field_name, row);
    if (!row.field_id) continue;
    const existing = byFieldId.get(row.field_id);
    byFieldId.set(row.field_id, existing ? preferFieldIdRow(existing, row) : row);
  }

  return { byFieldId, byFieldName };
}

export function findExistingFieldMapRow(
  field: Pick<NormalizedFeishuField, 'field_id' | 'field_name'>,
  indexes: FieldMapRowIndexes,
): ExistingFieldMapRow | undefined {
  return indexes.byFieldId.get(field.field_id) ?? indexes.byFieldName.get(field.field_name);
}

export function buildFieldMapSyncPlan(
  existingRows: ExistingFieldMapRow[],
  feishuFields: NormalizedFeishuField[],
  options: {
    baseApp: string;
    tableId: string;
    fillKnownOnly: boolean;
    fallbackFieldMap?: Record<string, FallbackFieldMapEntry>;
  },
): FieldMapSyncPlan {
  const indexes = indexFieldMapRows(existingRows);
  const toInsert: FieldMapSyncPlan['toInsert'] = [];
  const toUpdate: FieldMapSyncPlan['toUpdate'] = [];
  let skipped = 0;
  const fieldDescriptions: Record<string, string> = {};
  const fieldOptions: Record<string, FieldSelectOption[]> = {};
  const fallbackFieldMap = options.fallbackFieldMap ?? {};

  for (let i = 0; i < feishuFields.length; i++) {
    const field = feishuFields[i];
    if (!field.field_name || !field.field_id) continue;

    const existing = findExistingFieldMapRow(field, indexes);
    const fallback = fallbackFieldMap[field.field_name];
    const key = existing?.key ?? fallback?.key ?? field.field_name;

    if (existing) {
      toUpdate.push({
        id: existing.id,
        field_id: field.field_id,
        field_name: field.field_name,
        group_name: field.group_name,
        description: field.description,
        options: field.options,
      });
    } else {
      if (options.fillKnownOnly && !fallback) {
        skipped++;
        continue;
      }
      toInsert.push({
        base_app: options.baseApp,
        table_id: options.tableId,
        field_id: field.field_id,
        field_name: field.field_name,
        key: fallback?.key ?? `unknown_${field.field_id.slice(0, 8)}`,
        type: fallback?.type ?? 'text',
        group_name: fallback?.group ?? field.group_name,
        is_active: !!fallback,
        roles: ['sync', 'progress', 'wish-pool'],
        sort_order: i,
        description: field.description,
        options: field.options,
      });
    }

    if (field.description) fieldDescriptions[key] = field.description;
    if (field.options && field.options.length > 0) fieldOptions[key] = field.options;
  }

  return { toInsert, toUpdate, skipped, fieldDescriptions, fieldOptions };
}
