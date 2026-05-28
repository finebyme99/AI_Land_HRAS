import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

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

// GET /api/competitions/reviews/export
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const { data: reviews, error } = await getSupabaseAdmin()
    .from('competition_reviews')
    .select('*, reviewer:reviewer_id(name, department)')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: '导出失败' }, { status: 500 });
  }

  const header = '方案编号,方案名称,方案ID,评审人,部门,评审结果,推荐标杆,评审理由,评审时间';
  const rows = (reviews || []).map((r) =>
    [
      r.proposal_no ?? '',
      `"${(r.title || '').replace(/"/g, '""')}"`,
      r.submission_id,
      r.reviewer?.name || r.reviewer_id,
      r.reviewer?.department || '',
      r.decision === 'approved' ? '通过' : '驳回',
      r.is_benchmark ? '是' : '否',
      `"${(r.reason || '').replace(/"/g, '""')}"`,
      r.created_at,
    ].join(',')
  );

  const csv = '\uFEFF' + header + '\n' + rows.join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename=competition_reviews_${new Date().toISOString().slice(0, 10)}.csv`,
    },
  });
}
