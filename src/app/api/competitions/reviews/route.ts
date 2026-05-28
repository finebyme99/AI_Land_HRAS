import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function requireReviewer(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;

  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id, roles, name')
    .eq('id', userId)
    .single();

  if (!user || !user.roles?.some((r: string) => ['reviewer', 'admin', 'moderator'].includes(r))) return null;
  return user;
}

// GET /api/competitions/reviews?submission_id=xxx
export async function GET(request: NextRequest) {
  const reviewer = await requireReviewer(request);
  if (!reviewer) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const submissionId = request.nextUrl.searchParams.get('submission_id');
  const mine = request.nextUrl.searchParams.get('mine');

  let query = getSupabaseAdmin()
    .from('competition_reviews')
    .select('*, reviewer:reviewer_id(id, name, avatar, department)')
    .order('created_at', { ascending: false });

  if (submissionId) {
    query = query.eq('submission_id', submissionId);
  }
  if (mine === 'true') {
    query = query.eq('reviewer_id', reviewer.id);
  }

  const { data: reviews, error } = await query;
  if (error) {
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }

  return NextResponse.json({ reviews });
}

// POST /api/competitions/reviews
// Body: { submission_id, decision, reason? }
export async function POST(request: NextRequest) {
  const reviewer = await requireReviewer(request);
  if (!reviewer) {
    return NextResponse.json({ error: '无评审权限' }, { status: 403 });
  }

  const { submission_id, decision, reason, proposal_no, title, is_benchmark } = await request.json();

  if (!submission_id || !decision) {
    return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  }
  if (!['approved', 'rejected'].includes(decision)) {
    return NextResponse.json({ error: '无效的评审结果' }, { status: 400 });
  }
  if (decision === 'rejected' && (!reason || !reason.trim())) {
    return NextResponse.json({ error: '驳回时必须填写理由' }, { status: 400 });
  }

  const { data: review, error } = await getSupabaseAdmin()
    .from('competition_reviews')
    .upsert(
      {
        submission_id,
        reviewer_id: reviewer.id,
        decision,
        reason: reason || '',
        proposal_no: proposal_no ?? null,
        title: title || '',
        is_benchmark: decision === 'approved' ? !!is_benchmark : false,
      },
      { onConflict: 'submission_id,reviewer_id' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: '评审失败' }, { status: 500 });
  }

  return NextResponse.json({ review });
}
