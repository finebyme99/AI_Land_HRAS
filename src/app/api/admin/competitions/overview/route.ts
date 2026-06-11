import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SCORE_DIMENSIONS, type ReviewScores, type ReviewerRole } from '@/types';
import { pinyin } from 'pinyin-pro';

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
      .select('id, proposal_no, title, team, submitter, status, monthly_saved_hours, created_at, period, track, scene_category, ai_tools, efficiency_rate, before_process, pain_points, after_process, demo_link, record_url, ai_cost, extra_value, team_members, implementation, verifier, before_hours_per_person, before_people_count, after_hours_per_person, after_people_count, old_operation_count, new_operation_count, old_hours_per_task, new_duration, old_people_count, new_people_count, old_frequency, new_frequency, reuse_value, reuse_value_level, monthly_saved_cost, cost_reduction_note, implementation_link, final_value_score')
      .eq('period', period)
      .eq('status', '评审中')
      .order('proposal_no', { ascending: true });
    if (sErr) throw sErr;
    const submissions = subs ?? [];
    const subIds = submissions.map((s) => s.id);

    // 2. 拉这些 submissions 的所有 reviews（含 reviewer 名字）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let reviews: any[] = [];
    if (subIds.length > 0) {
      const { data: r, error: rErr } = await supabase
        .from('competition_reviews')
        .select('id, submission_id, reviewer_id, reviewer_role, decision, reason, scores, reviewer:reviewer_id(name)')
        .in('submission_id', subIds);
      if (rErr) throw rErr;
      reviews = (r ?? []) as any[];
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
      // 跨角色总分 = 三个角色均分之和，转换为 100 制（×2）
      const roleParts: number[] = [];
      (['user', 'business', 'tech'] as ReviewerRole[]).forEach((r) => { if (roleScores[r] != null) roleParts.push(roleScores[r]!); });
      const rawTotal = roleParts.length > 0
        ? Math.round(roleParts.reduce((a, b) => a + b, 0) * 10) / 10
        : null;
      const totalScore = rawTotal != null ? Math.round(rawTotal * 2 * 10) / 10 : null;
      // 状态
      const allReviewed = subReviews.filter((r) => r.decision === 'reviewed' && r.reviewer_role);
      const reviewedRoles = new Set(allReviewed.map((r) => r.reviewer_role));
      const status: 'reviewed' | 'pending' = reviewedRoles.size >= 3 ? 'reviewed' : 'pending';
      // 团队/提报人在 DB 里是 people 字段（数组），扁平化成字符串
      const teamArr = Array.isArray(sub.team) ? (sub.team as string[]) : (sub.team ? [String(sub.team)] : []);
      const submitterArr = Array.isArray(sub.submitter) ? (sub.submitter as string[]) : (sub.submitter ? [String(sub.submitter)] : []);
      const teamMembersArr = Array.isArray(sub.team_members) ? (sub.team_members as string[]) : (sub.team_members ? [String(sub.team_members)] : []);
      // contributors = submitter + team_members 整合去重，保留首次出现顺序
      const seen = new Set<string>();
      const contributorsArr: string[] = [];
      for (const n of [...submitterArr, ...teamMembersArr]) {
        const t = n?.trim();
        if (!t || seen.has(t)) continue;
        seen.add(t);
        contributorsArr.push(t);
      }
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
            weightedScore: role ? Math.round(computeWeightedScore(r.scores ?? {}, role) * 2 * 10) / 10 : 0,
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
        // contributors = 提报人 + 团队成员 整合去重
        authorName: contributorsArr.join(' / '),
        contributors: contributorsArr,
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
        // 量化数据（before/after 对比）
        beforeHoursPerPerson: sub.before_hours_per_person ?? null,
        beforePeopleCount: sub.before_people_count ?? null,
        afterHoursPerPerson: sub.after_hours_per_person ?? null,
        afterPeopleCount: sub.after_people_count ?? null,
        oldOperationCount: sub.old_operation_count ?? null,
        newOperationCount: sub.new_operation_count ?? null,
        oldHoursPerTask: sub.old_hours_per_task ?? null,
        newDuration: sub.new_duration ?? null,
        oldPeopleCount: sub.old_people_count ?? null,
        newPeopleCount: sub.new_people_count ?? null,
        oldFrequency: sub.old_frequency ?? null,
        newFrequency: sub.new_frequency ?? null,
        reuseValue: sub.reuse_value ?? null,
        reuseValueLevel: sub.reuse_value_level ?? null,
        monthlySavedCost: sub.monthly_saved_cost ?? null,
        costReductionNote: sub.cost_reduction_note ?? null,
        implementationLink: sub.implementation_link ?? null,
        finalValueScore: sub.final_value_score ?? null,
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
    // 复用价值等级分布（直接用 reuseValueLevel 字段）
    const reuseValueCounts: Record<string, number> = {};
    for (const s of enriched) {
      const level = s.reuseValueLevel;
      if (!level) continue;
      reuseValueCounts[level] = (reuseValueCounts[level] ?? 0) + 1;
    }
    // 复用价值描述分布（按 reuseValue 原文分组 — "跨多个BU/多个条线可用 x3" 等具体描述）
    const reuseValueDistribution: Record<string, number> = {};
    for (const s of enriched) {
      const desc = s.reuseValue;
      if (!desc) continue;
      reuseValueDistribution[desc] = (reuseValueDistribution[desc] ?? 0) + 1;
    }
    // 总节省工时
    const totalSavedHours = Math.round(
      enriched.reduce((s, x) => s + (x.monthlySavedHours ?? 0), 0) * 10,
    ) / 10;
    // 平均提效比例
    const withRate = enriched.filter((s) => s.efficiencyRate != null);
    const avgEfficiencyRate = withRate.length > 0
      ? Math.round((withRate.reduce((s, x) => s + (x.efficiencyRate ?? 0), 0) / withRate.length) * 1000) / 1000
      : null;
    // 5. 评委团（按角色聚合本期所有已评审的人）
    const panelByRole: Record<ReviewerRole, string[]> = { user: [], business: [], tech: [] };
    const seenByRole: Record<ReviewerRole, Set<string>> = { user: new Set(), business: new Set(), tech: new Set() };
    for (const r of reviews) {
      if (r.decision !== 'reviewed' || !r.reviewer_role) continue;
      const role = r.reviewer_role as ReviewerRole;
      const name = (Array.isArray(r.reviewer) ? r.reviewer[0]?.name : r.reviewer?.name)?.trim() || '匿名';
      if (seenByRole[role].has(name)) continue;
      seenByRole[role].add(name);
      panelByRole[role].push(name);
    }
    // 姓氏读音特例：pinyin-pro 默认读音对姓氏场景有偏，覆盖
    const SURNAME_PINYIN: Record<string, string> = {
      曾: 'zeng',  // 姓读 zēng，pinyin-pro 默认给 céng
    };
    function nameFirstLetter(name: string): string {
      const c = (name[0] || '').trim();
      if (/[A-Za-z]/.test(c)) return c.toUpperCase();
      if (SURNAME_PINYIN[c]) return SURNAME_PINYIN[c][0].toUpperCase();
      try {
        const py = pinyin(c, { toneType: 'none', type: 'array' });
        return (py[0]?.[0] || c).toUpperCase();
      } catch {
        return c.toUpperCase();
      }
    }
    function nameSortKey(name: string): string {
      const c = (name[0] || '').trim();
      if (/[A-Za-z]/.test(c)) return c.toUpperCase();
      // 全名拼音：逐字替换姓氏特例
      let py: string;
      try {
        py = pinyin(name, { toneType: 'none', type: 'array' }).join('');
      } catch {
        return name.toUpperCase();
      }
      if (SURNAME_PINYIN[c]) py = SURNAME_PINYIN[c] + py.slice(1);
      return py.toUpperCase();
    }
    for (const role of ['user', 'business', 'tech'] as ReviewerRole[]) {
      panelByRole[role].sort((a, b) => {
        const fa = nameFirstLetter(a);
        const fb = nameFirstLetter(b);
        if (fa !== fb) return fa.localeCompare(fb);
        return nameSortKey(a).localeCompare(nameSortKey(b));
      });
    }

    return NextResponse.json(
      {
        period,
        summary: { total, reviewed, pending, avgScore, totalSavedHours, avgEfficiencyRate, reuseValueCounts, reuseValueDistribution },
        submissions: enriched,
        panel: panelByRole,
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
