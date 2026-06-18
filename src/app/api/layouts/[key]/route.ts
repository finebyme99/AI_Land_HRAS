/**
 * 布局配置 API
 *
 * GET  /api/layouts/[key]         任何登录用户可读（含 fallback 默认）
 * PUT  /api/layouts/[key]         仅 admin / moderator
 *
 * 读取场景：competitions 页面渲染 hover 卡片时，全员可读 → 走 GET 拿最新 layout
 * 写入场景：admin 在 /admin/layouts/[key] 配置面板保存 → 走 PUT
 *
 * fallback：DB 没记录时返回 DEFAULT_ENTRY_CARD_LAYOUT（前端不需要感知）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { DEFAULT_ENTRY_CARD_LAYOUT, type EntryCardLayout } from '@/lib/entry-card-layout';

const VALID_KEYS = new Set(['competitions-entry-card']);

/** key → 默认布局的映射（未来扩展加在这里） */
const DEFAULTS: Record<string, EntryCardLayout> = {
  'competitions-entry-card': DEFAULT_ENTRY_CARD_LAYOUT,
};

async function requireAdmin(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;
  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id, roles')
    .eq('id', userId)
    .single();
  if (!user || !user.roles?.some((r: string) => ['admin', 'moderator'].includes(r))) return null;
  return user;
}

async function getCurrentUserId(request: NextRequest): Promise<string | null> {
  return request.cookies.get('feishu_user_id')?.value ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  if (!VALID_KEYS.has(key)) {
    return NextResponse.json({ error: `未知的 layout key: ${key}` }, { status: 404 });
  }

  // 检查登录（不强制 admin，普通登录用户即可读，因为渲染卡片时全员要读）
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('app_layout_configs')
    .select('config, updated_at, updated_by')
    .eq('scope', 'global')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const fallback = DEFAULTS[key];
  if (!data) {
    return NextResponse.json({
      key,
      config: fallback,
      isDefault: true,
      updatedAt: null,
      updatedBy: null,
    });
  }

  return NextResponse.json({
    key,
    config: data.config as EntryCardLayout,
    isDefault: false,
    updatedAt: data.updated_at,
    updatedBy: data.updated_by,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  if (!VALID_KEYS.has(key)) {
    return NextResponse.json({ error: `未知的 layout key: ${key}` }, { status: 404 });
  }

  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '仅管理员可修改布局' }, { status: 403 });
  }

  const body = await request.json();
  const { config } = body as { config: EntryCardLayout };

  // 基础校验
  if (!config || !Array.isArray(config.groups) || !Array.isArray(config.hiddenFields)) {
    return NextResponse.json(
      { error: 'config 必须包含 groups[] 和 hiddenFields[]' },
      { status: 400 },
    );
  }

  // 每个 group 的 fields 必须为字符串数组，id/title/color 非空
  for (const g of config.groups) {
    if (!g.id || !g.title || typeof g.color !== 'string' || !Array.isArray(g.fields)) {
      return NextResponse.json(
        { error: `分组 ${g.id || '(?)'} 缺少 id/title/color/fields` },
        { status: 400 },
      );
    }
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('app_layout_configs')
    .upsert(
      {
        scope: 'global',
        key,
        config,
        updated_by: admin.id,
      },
      { onConflict: 'scope,key' },
    )
    .select('config, updated_at, updated_by')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    key,
    config: data.config as EntryCardLayout,
    isDefault: false,
    updatedAt: data.updated_at,
    updatedBy: data.updated_by,
  });
}
