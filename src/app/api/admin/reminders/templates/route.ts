// src/app/api/admin/reminders/templates/route.ts
// 消息模板管理 API

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET /api/admin/reminders/templates
// 获取所有消息模板
export async function GET(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  // 检查管理员权限
  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id, roles')
    .eq('id', userId)
    .single();

  if (!user || !user.roles?.includes('admin')) {
    return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });
  }

  const { data: templates, error } = await getSupabaseAdmin()
    .from('message_templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: '获取模板失败' }, { status: 500 });
  }

  return NextResponse.json({ templates });
}

// POST /api/admin/reminders/templates
// 创建消息模板
export async function POST(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  // 检查管理员权限
  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id, roles')
    .eq('id', userId)
    .single();

  if (!user || !user.roles?.includes('admin')) {
    return NextResponse.json({ error: '仅管理员可创建模板' }, { status: 403 });
  }

  const body = await request.json();
  const { name, type, title_template, content_template, card_template } = body;

  if (!name || !content_template) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
  }

  const { data: template, error } = await getSupabaseAdmin()
    .from('message_templates')
    .insert({
      name,
      type: type || 'card',
      title_template: title_template || null,
      content_template,
      card_template: card_template || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: '创建模板失败' }, { status: 500 });
  }

  return NextResponse.json({ template });
}
