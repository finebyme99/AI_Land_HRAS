import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET: 推送历史
export async function GET() {
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
