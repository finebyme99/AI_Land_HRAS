import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SCORE_DIMENSIONS, type ReviewScores, type ReviewerRole } from '@/types';

function computeWeightedScore(scores: ReviewScores, role: ReviewerRole): number {
  const dims = SCORE_DIMENSIONS[role];
  if (!dims) return 0;
  return dims.reduce((sum, dim) => {
    const val = scores[dim.key];
    return sum + (val != null ? val * dim.weight : 0);
  }, 0);
}

async function requireAdmin(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;
  const { data: user } = await getSupabaseAdmin()
    .from('users').select('id, roles').eq('id', userId).single();
  if (!user || !user.roles?.some((r: string) => ['admin', 'moderator'].includes(r))) return null;
  return user;
}

/**
 * GET /api/admin/competitions/overview?period=2605
 *
 * 评审一览：聚合本期 submissions + 所有 reviews，给管理端页用。
 * 返回：{ period, summary, submissions[] }
 *   submissions[i].roleScores = { user, business, tech } — 该角色已评审人次的平均加权分
 *   submissions[i].totalScore  — 跨角色所有已评审人次的加权分平均
 *   submissions[i].reviews     — 每条评审的明细（穿透到弹窗用）
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });

  const period = request.nextUrl.searchParams.get('period') ?? '2605';
  const supabase = getSupabaseAdmin();

  try {
    // 1. 拉本期 submissions（只看"评审中"）
    const { data: subs, error: sErr } = await supabase
      .from('competition_submissions')
      .select('id, proposal_no, title, team, submitter, status, monthly_saved_hours, created_at, period, track, scene_category, ai_tools, efficiency_rate, before_process, pain_points, after_process, demo_link, record_url, ai_cost, extra_value, team_members, implementation, verifier')
      .eq('period', period)
      .eq('status', '评审中')
      .order('proposal_no', { ascending: true });
    if (sErr) throw sErr;
    const submissions = subs ?? [];
    const subIds = submissions.map((s) => s.id);

    // 2. 拉这些 submissions 的所有 reviews（含 reviewer 名字）
    let reviews: Array<{
      id: string;
      submission_id: string;
      reviewer_id: string;
      reviewer_role: ReviewerRole | null;
      decision: string;
      reason: string;
      scores: ReviewScores;
      reviewer?: { name: string } | null;
    }> = [];
    if (subIds.length > 0) {
      const { data: r, error: rErr } = await supabase
        .from('competition_reviews')
        .select('id, submission_id, reviewer_id, reviewer_role, decision, reason, scores, reviewer:reviewer_id(name)')
        .in('submission_id', subIds);
      if (rErr) throw rErr;
      reviews = (r ?? []) as typeof reviews;
    }

    // 3. 聚合：按 submission 分组
    const bySub: Record<string, typeof reviews> = {};
    for (const r of reviews) {
      (bySub[r.submission_id] ??= []).push(r);
    }

    const enriched = submissions.map((sub) => {
      const subReviews = bySub[sub.id] ?? [];
      // 角色维度的总分（取该角色所有已评审人次的加权分平均）
      const roleScores: Record<ReviewerRole, number | null> = { user: null, business: null, tech: null };
      (['user', 'business', 'tech'] as ReviewerRole[]).forEach((role) => {
        const roleRevs = subReviews.filter((r) => r.reviewer_role === role && r.decision === 'reviewed');
        if (roleRevs.length > 0) {
          const avg = roleRevs.reduce((s, r) => s + computeWeightedScore(r.scores ?? {}, role), 0) / roleRevs.length;
          roleScores[role] = Math.round(avg * 10) / 10;
        }
      });
      // 跨角色总分 = 三个角色均分之和（每角色 5 分制，含权重后最高 19.5/19.5/11 = 50）
      const roleParts: number[] = [];
      (['user', 'business', 'tech'] as ReviewerRole[]).forEach((r) => { if (roleScores[r] != null) roleParts.push(roleScores[r]!); });
      const totalScore = roleParts.length > 0
        ? Math.round(roleParts.reduce((a, b) => a + b, 0) * 10) / 10
        : null;
      // 状态
      const allReviewed = subReviews.filter((r) => r.decision === 'reviewed' && r.reviewer_role);
      const reviewedRoles = new Set(allReviewed.map((r) => r.reviewer_role));
      const status: 'reviewed' | 'pending' = reviewedRoles.size >= 3 ? 'reviewed' : 'pending';
      // 团队/提报人在 DB 里是 people 字段（数组），扁平化成字符串
      const teamArr = Array.isArray(sub.team) ? (sub.team as string[]) : (sub.team ? [String(sub.team)] : []);
      const submitterArr = Array.isArray(sub.submitter) ? (sub.submitter as string[]) : (sub.submitter ? [String(sub.submitter)] : []);
      const aiToolsArr = Array.isArray(sub.ai_tools) ? (sub.ai_tools as string[]) : (sub.ai_tools ? [String(sub.ai_tools)] : []);
      const painPointsArr = Array.isArray(sub.pain_points) ? (sub.pain_points as string[]) : (sub.pain_points ? [String(sub.pain_points)] : []);
      const verifierArr = Array.isArray(sub.verifier) ? (sub.verifier as string[]) : (sub.verifier ? [String(sub.verifier)] : []);
      // reviews 排序：先按角色（user→business→tech），再按加权分降序
      const ROLE_ORDER: ReviewerRole[] = ['user', 'business', 'tech'];
      const reviewsOut = subReviews
        .map((r) => {
          const role = r.reviewer_role;
          return {
            id: r.id,
            reviewerName: r.reviewer?.name ?? '匿名',
            reviewerRole: role,
            decision: r.decision,
            scores: r.scores ?? {},
            weightedScore: role ? Math.round(computeWeightedScore(r.scores ?? {}, role) * 10) / 10 : 0,
            reason: r.reason ?? '',
          };
        })
        .sort((a, b) => {
          const oa = a.reviewerRole ? ROLE_ORDER.indexOf(a.reviewerRole) : 99;
          const ob = b.reviewerRole ? ROLE_ORDER.indexOf(b.reviewerRole) : 99;
          if (oa !== ob) return oa - ob;
          return b.weightedScore - a.weightedScore;
        });
      return {
        id: sub.id,
        title: sub.title,
        team: teamArr.join(' / '),
        authorName: submitterArr.join(' / '),
        proposalNo: sub.proposal_no,
        submittedAt: sub.created_at,
        status,
        totalScore,
        reviewCount: allReviewed.length,
        roleScores,
        reviews: reviewsOut,
        // 方案详情（弹窗用）
        track: sub.track ?? '',
        sceneCategory: sub.scene_category ?? '',
        aiTools: aiToolsArr,
        monthlySavedHours: sub.monthly_saved_hours ?? null,
        efficiencyRate: sub.efficiency_rate ?? null,
        beforeProcess: sub.before_process ?? '',
        painPoints: painPointsArr,
        afterProcess: sub.after_process ?? '',
        demoLink: sub.demo_link ?? '',
        recordUrl: sub.record_url ?? '',
        aiCost: sub.ai_cost ?? '',
        extraValue: sub.extra_value ?? '',
        teamMembers: Array.isArray(sub.team_members) ? sub.team_members.join(' / ') : (sub.team_members ?? ''),
        implementation: sub.implementation ?? '',
        verifier: verifierArr.join(' / '),
      };
    });

    // 4. 顶部汇总（基于过滤后的 13 个"评审中"）
    const total = enriched.length;
    const reviewed = enriched.filter((s) => s.status === 'reviewed').length;
    const pending = total - reviewed;
    const scored = enriched.filter((s) => s.totalScore != null);
    const avgScore = scored.length > 0
      ? Math.round((scored.reduce((s, x) => s + (x.totalScore ?? 0), 0) / scored.length) * 10) / 10
      : null;

    return NextResponse.json(
      {
        period,
        summary: { total, reviewed, pending, avgScore },
        submissions: enriched,
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
    );
  } catch (err: unknown) {
    console.error('[overview] failed:', err);
    const msg = err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : '聚合失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
