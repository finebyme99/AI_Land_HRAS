import { NextResponse } from 'next/server';
import { syncFieldMapFromFeishu } from '@/lib/bitable/sync-field-map';

// ── 飞书多维表格配置（同 wish-pool/route.ts）──
const BASE_APP = 'LRROwulJciI7JYkIT55cQtdpnze';
const TABLE_ID = 'tbl9WJyxl9bbtYjb';

/**
 * POST /api/wish-pool/sync-field-map
 *
 * 仅同步字段映射（含 options 选项列表），不涉及记录写入。
 * 供 wish-pool「刷新」按钮调用，确保筛选枚举跟随飞书最新配置。
 * ChoDashboard 的 sync 按钮已有此联动（作为副作用），此端点补齐 wish-pool 的缺失。
 */
export async function POST() {
  const result = await syncFieldMapFromFeishu(BASE_APP, TABLE_ID, { fillKnownOnly: false });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    inserted: result.inserted,
    updated: result.updated,
    skipped: result.skipped,
    total_feishu: result.totalFeishu,
  });
}
