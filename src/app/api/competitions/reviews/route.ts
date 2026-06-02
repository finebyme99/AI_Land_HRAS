import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { ReviewerRole, ReviewScores } from '@/types';
import { SCORE_DIMENSIONS } from '@/types';
import { getReminderRulesByEvent, sendReviewCompletedNotification } from '@/lib/reminder-service';

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

  return NextResponse.json({ reviews }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
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

  const row = {
    submission_id,
    reviewer_id: reviewer.id,
    decision: 'reviewed',
    scores,
    reviewer_role,
    reason: reason || '',
    proposal_no: proposal_no ?? null,
    title: title || '',
  };

  // 检查是否已有记录（含旧机制的 approved/rejected）
  const { data: existing } = await getSupabaseAdmin()
    .from('competition_reviews')
    .select('id, decision')
    .eq('submission_id', submission_id)
    .eq('reviewer_id', reviewer.id)
    .maybeSingle();

  let review;
  let error;

  if (existing) {
    // 已有记录 → 更新评分
    const result = await getSupabaseAdmin()
      .from('competition_reviews')
      .update(row)
      .eq('id', existing.id)
      .select()
      .single();
    review = result.data;
    error = result.error;
  } else {
    // 无记录 → 新建
    const result = await getSupabaseAdmin()
      .from('competition_reviews')
      .insert(row)
      .select()
      .single();
    review = result.data;
    error = result.error;
  }

  if (error) {
    return NextResponse.json({ error: `评审失败: ${error.message}` }, { status: 500 });
  }
  if (!review) {
    return NextResponse.json({ error: '评审保存失败，未返回数据' }, { status: 500 });
  }

  // 异步触发评审完成提醒（不阻塞响应）
  if (title) {
    getReminderRulesByEvent('review_completed')
      .then(async (rules) => {
        for (const rule of rules) {
          try {
            // 查询方案提交人
            const { data: submission } = await getSupabaseAdmin()
              .from('competition_submissions')
              .select('submitter_id')
              .eq('id', submission_id)
              .single();

            if (submission?.submitter_id) {
              await sendReviewCompletedNotification({
                submissionId: submission_id,
                title: title,
                submitterId: submission.submitter_id,
                score: total,
                maxScore: dims.reduce((sum, dim) => sum + 5 * dim.weight, 0),
                result: '已完成评审',
              });
            }
          } catch (err) {
            console.error('发送评审完成提醒失败:', err);
          }
        }
      })
      .catch((err) => {
        console.error('获取提醒规则失败:', err);
      });
  }

  return NextResponse.json({ review, total });
}

// DELETE /api/competitions/reviews?reviewer_id=xxx
// 清空指定评委的全部评分（仅 admin/moderator）
export async function DELETE(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id, roles')
    .eq('id', userId)
    .single();

  if (!user || !user.roles?.some((r: string) => ['admin', 'moderator'].includes(r))) {
    return NextResponse.json({ error: '仅管理员可清空评分' }, { status: 403 });
  }

  const reviewerId = request.nextUrl.searchParams.get('reviewer_id');
  if (!reviewerId) {
    return NextResponse.json({ error: '缺少 reviewer_id 参数' }, { status: 400 });
  }

  const { data, error, count } = await getSupabaseAdmin()
    .from('competition_reviews')
    .delete({ count: 'exact' })
    .eq('reviewer_id', reviewerId);

  if (error) {
    return NextResponse.json({ error: `清空失败: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ deleted: count ?? 0 });
}
