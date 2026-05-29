import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { ReviewerRole, ReviewScores, ScoreDimension } from '@/types';

const SCORE_DIMENSIONS: Record<ReviewerRole, ScoreDimension[]> = {
  user: [
    { key: 'scenario', label: '场景明确性', weight: 1.5, highSignal: '', lowSignal: '' },
    { key: 'painPoint', label: '痛点真实性', weight: 1.2, highSignal: '', lowSignal: '' },
    { key: 'effectiveness', label: '产品实用性', weight: 1.2, highSignal: '', lowSignal: '' },
  ],
  business: [
    { key: 'replicability', label: '可复用性', weight: 1.5, highSignal: '', lowSignal: '' },
    { key: 'dataReliability', label: '数据详实度', weight: 1.2, highSignal: '', lowSignal: '' },
    { key: 'breakthrough', label: '突破开创性', weight: 1.2, highSignal: '', lowSignal: '' },
  ],
  tech: [
    { key: 'techUsability', label: '技术可用性', weight: 1.2, highSignal: '', lowSignal: '' },
    { key: 'toolFit', label: '工具合理性', weight: 1.0, highSignal: '', lowSignal: '' },
  ],
};

function computeWeightedScore(scores: ReviewScores, role: ReviewerRole): number {
  const dims = SCORE_DIMENSIONS[role];
  return dims.reduce((sum, dim) => {
    const val = scores[dim.key];
    return sum + (val != null ? val * dim.weight : 0);
  }, 0);
}

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
// Body: { submission_id, scores, reviewer_role, reason?, proposal_no?, title?, is_benchmark? }
export async function POST(request: NextRequest) {
  const reviewer = await requireReviewer(request);
  if (!reviewer) {
    return NextResponse.json({ error: '无评审权限' }, { status: 403 });
  }

  const { submission_id, scores, reviewer_role, reason, proposal_no, title } = await request.json();

  if (!submission_id) {
    return NextResponse.json({ error: '缺少方案ID' }, { status: 400 });
  }
  if (!reviewer_role || !['user', 'business', 'tech'].includes(reviewer_role)) {
    return NextResponse.json({ error: '请选择评委角色' }, { status: 400 });
  }
  if (!scores || typeof scores !== 'object') {
    return NextResponse.json({ error: '请填写评分' }, { status: 400 });
  }

  // 校验该角色下所有维度均已评分（1-5）
  const dims = SCORE_DIMENSIONS[reviewer_role as ReviewerRole];
  for (const dim of dims) {
    const val = scores[dim.key];
    if (val == null || val < 1 || val > 5 || !Number.isInteger(val)) {
      return NextResponse.json({ error: `${dim.label} 评分需为 1-5 的整数` }, { status: 400 });
    }
  }

  const total = computeWeightedScore(scores, reviewer_role as ReviewerRole);

  // 检查是否已有评审记录，已有则拒绝
  const { data: existing } = await getSupabaseAdmin()
    .from('competition_reviews')
    .select('id')
    .eq('submission_id', submission_id)
    .eq('reviewer_id', reviewer.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: '该方案已评审，不可重复提交' }, { status: 409 });
  }

  const { data: review, error } = await getSupabaseAdmin()
    .from('competition_reviews')
    .insert(
      {
        submission_id,
        reviewer_id: reviewer.id,
        decision: 'reviewed',
        scores,
        reviewer_role,
        reason: reason || '',
        proposal_no: proposal_no ?? null,
        title: title || '',
      },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: '评审失败' }, { status: 500 });
  }

  return NextResponse.json({ review, total });
}
