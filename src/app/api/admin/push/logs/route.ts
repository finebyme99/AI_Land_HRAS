import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET: 推送历史
export async function GET(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!(await hasPermission(userId, 'admin.push'))) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('push_logs')
      .select('id, content_type, content_title, target_chat_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json({ logs: data ?? [] });
  } catch (err) {
    console.error('获取推送日志失败:', err);
    return NextResponse.json({ logs: [] });
  }
}
