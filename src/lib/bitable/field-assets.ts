type FieldAssetStatus = 'used' | 'bound_unshown' | 'pending' | 'inactive' | 'renamed';
type SourceType = 'feishu_bitable' | 'ai_land_calculated' | 'ai_land_system';

export interface FieldAssetInputRow {
  id?: string;
  field_id: string | null;
  field_name: string;
  previous_field_name?: string;
  key: string;
  type: string;
  group_name: string;
  is_active: boolean;
  roles: string[];
  sort_order: number;
  status: 'synced' | 'renamed' | 'new' | 'orphan' | 'inactive';
}

export interface FieldDefinition {
  key: string;
  label: string;
  logic: string;
  dependencyKeys?: string[];
  implementation: string;
}

export interface FieldAlias {
  label: string;
  context: string;
}

export interface FieldUsage {
  key: string;
  label: string;
}

export interface FieldAsset {
  key: string;
  displayName: string;
  aliases: FieldAlias[];
  sourceType: SourceType;
  sourceLabel: string;
  sourceDetail: {
    currentFieldName?: string;
    fieldId?: string | null;
    logic?: string;
    implementation?: string;
  };
  renameInfo: {
    renamed: boolean;
    currentName?: string;
    previousNames: string[];
  };
  status: FieldAssetStatus;
  usage: FieldUsage[];
  dependencies: Array<{ key: string; label: string }>;
  rows: FieldAssetInputRow[];
}

export interface UnusedFeishuField {
  id?: string;
  fieldId: string | null;
  fieldName: string;
  groupName: string;
  type: string;
  status: FieldAssetInputRow['status'];
  previousFieldName?: string;
}

export interface BuildAiLandFieldAssetsInput {
  rows: FieldAssetInputRow[];
  fieldLabels: Record<string, string>;
  pageLabels: Record<string, string>;
  pageUsage: Record<string, ReadonlySet<string>>;
  keyAliases?: Record<string, string[]>;
  calculatedFields: FieldDefinition[];
  systemFields: FieldDefinition[];
}

function isUnknownKey(key: string): boolean {
  return key.startsWith('unknown_');
}

function uniqueByLabelAndContext(aliases: FieldAlias[]): FieldAlias[] {
  const seen = new Set<string>();
  return aliases.filter((alias) => {
    const k = `${alias.context}::${alias.label}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function labelsForDisplay(aliases: FieldAlias[]): string {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const alias of aliases) {
    if (alias.context === '飞书历史字段名') continue;
    if (seen.has(alias.label)) continue;
    seen.add(alias.label);
    labels.push(alias.label);
  }
  return labels.join(' / ');
}

function usageForKey(
  key: string,
  pageLabels: Record<string, string>,
  pageUsage: Record<string, ReadonlySet<string>>,
  keyAliases: Record<string, string[]> = {},
): FieldUsage[] {
  const acceptedKeys = new Set([key, ...(keyAliases[key] ?? [])]);
  return Object.entries(pageUsage)
    .filter(([, keys]) => [...acceptedKeys].some((acceptedKey) => keys.has(acceptedKey)))
    .map(([pageKey]) => ({ key: pageKey, label: pageLabels[pageKey] ?? pageKey }));
}

function aliasFieldsForPages(
  key: string,
  fieldLabels: Record<string, string>,
  pageLabels: Record<string, string>,
  pageUsage: Record<string, ReadonlySet<string>>,
  keyAliases: Record<string, string[]> = {},
): FieldAlias[] {
  const aliases: FieldAlias[] = [];
  for (const aliasKey of keyAliases[key] ?? []) {
    for (const [pageKey, keys] of Object.entries(pageUsage)) {
      if (!keys.has(aliasKey)) continue;
      aliases.push({
        label: fieldLabels[aliasKey] ?? aliasKey,
        context: `${pageLabels[pageKey] ?? pageKey}字段`,
      });
    }
  }
  return aliases;
}

function statusForRows(rows: FieldAssetInputRow[], usage: FieldUsage[]): FieldAssetStatus {
  if (rows.some((row) => row.status === 'renamed')) return 'renamed';
  if (rows.every((row) => !row.is_active || row.status === 'inactive')) return 'inactive';
  return usage.length > 0 ? 'used' : 'bound_unshown';
}

function dependenciesForKeys(keys: string[] | undefined, labels: Record<string, string>): Array<{ key: string; label: string }> {
  return (keys ?? []).map((key) => ({ key, label: labels[key] ?? key }));
}

function assetFromDefinition(
  definition: FieldDefinition,
  sourceType: 'ai_land_calculated' | 'ai_land_system',
  sourceLabel: string,
  input: BuildAiLandFieldAssetsInput,
): FieldAsset {
  const usage = usageForKey(definition.key, input.pageLabels, input.pageUsage, input.keyAliases);
  const aliases = uniqueByLabelAndContext([
    { label: definition.label, context: 'AI Land标准字段' },
    ...aliasFieldsForPages(definition.key, input.fieldLabels, input.pageLabels, input.pageUsage, input.keyAliases),
  ]);
  return {
    key: definition.key,
    displayName: labelsForDisplay(aliases),
    aliases,
    sourceType,
    sourceLabel,
    sourceDetail: { logic: definition.logic, implementation: definition.implementation },
    renameInfo: { renamed: false, previousNames: [] },
    status: usage.length > 0 ? 'used' : 'bound_unshown',
    usage,
    dependencies: dependenciesForKeys(definition.dependencyKeys, input.fieldLabels),
    rows: [],
  };
}

export function buildAiLandFieldAssets(input: BuildAiLandFieldAssetsInput): {
  assets: FieldAsset[];
  unusedFeishuFields: UnusedFeishuField[];
  stats: {
    used: number;
    boundUnshown: number;
    inactive: number;
    renamed: number;
    unusedFeishu: number;
    totalAssets: number;
  };
} {
  const rowsByKey = new Map<string, FieldAssetInputRow[]>();
  const unusedFeishuFields: UnusedFeishuField[] = [];

  for (const row of input.rows) {
    if (isUnknownKey(row.key)) {
      unusedFeishuFields.push({
        id: row.id,
        fieldId: row.field_id,
        fieldName: row.field_name,
        groupName: row.group_name,
        type: row.type,
        status: row.status,
        previousFieldName: row.previous_field_name,
      });
      continue;
    }
    const rows = rowsByKey.get(row.key) ?? [];
    rows.push(row);
    rowsByKey.set(row.key, rows);
  }

  const assets: FieldAsset[] = [];
  for (const [key, rows] of rowsByKey.entries()) {
    const sortedRows = [...rows].sort((a, b) => a.sort_order - b.sort_order);
    const primary = sortedRows[0];
    const usage = usageForKey(key, input.pageLabels, input.pageUsage, input.keyAliases);
    const previousNames = sortedRows
      .map((row) => row.previous_field_name)
      .filter((name): name is string => !!name);
    const aliases = uniqueByLabelAndContext([
      { label: input.fieldLabels[key] ?? key, context: 'AI Land标准字段' },
      ...aliasFieldsForPages(key, input.fieldLabels, input.pageLabels, input.pageUsage, input.keyAliases),
      ...sortedRows.map((row) => ({ label: row.field_name, context: '飞书多维表字段' })),
      ...previousNames.map((name) => ({ label: name, context: '飞书历史字段名' })),
    ]);

    assets.push({
      key,
      displayName: labelsForDisplay(aliases),
      aliases,
      sourceType: 'feishu_bitable',
      sourceLabel: '飞书多维表字段',
      sourceDetail: {
        currentFieldName: primary.field_name,
        fieldId: primary.field_id,
      },
      renameInfo: {
        renamed: sortedRows.some((row) => row.status === 'renamed'),
        currentName: primary.field_name,
        previousNames,
      },
      status: statusForRows(sortedRows, usage),
      usage,
      dependencies: [],
      rows: sortedRows,
    });
  }

  for (const definition of input.calculatedFields) {
    if (!rowsByKey.has(definition.key)) {
      assets.push(assetFromDefinition(definition, 'ai_land_calculated', 'AI Land计算字段', input));
    }
  }
  for (const definition of input.systemFields) {
    if (!rowsByKey.has(definition.key)) {
      assets.push(assetFromDefinition(definition, 'ai_land_system', 'AI Land系统字段', input));
    }
  }

  const stats = {
    used: assets.filter((asset) => asset.status === 'used').length,
    boundUnshown: assets.filter((asset) => asset.status === 'bound_unshown').length,
    inactive: assets.filter((asset) => asset.status === 'inactive').length,
    renamed: assets.filter((asset) => asset.status === 'renamed').length,
    unusedFeishu: unusedFeishuFields.length,
    totalAssets: assets.length,
  };

  return { assets, unusedFeishuFields, stats };
}
