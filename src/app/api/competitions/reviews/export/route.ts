import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { ReviewScores, ReviewerRole } from '@/types';

const SCORE_DIMENSIONS: Record<ReviewerRole, { key: keyof ReviewScores; label: string; weight: number }[]> = {
  user: [
    { key: 'scenario', label: '场景明确性', weight: 1.5 },
    { key: 'painPoint', label: '痛点真实性', weight: 1.2 },
    { key: 'effectiveness', label: '产品实用性', weight: 1.2 },
  ],
  business: [
    { key: 'replicability', label: '可复用性', weight: 1.5 },
    { key: 'dataReliability', label: '数据详实度', weight: 1.2 },
    { key: 'breakthrough', label: '突破开创性', weight: 1.2 },
  ],
  tech: [
    { key: 'techUsability', label: '技术可用性', weight: 1.2 },
    { key: 'toolFit', label: '工具合理性', weight: 1.0 },
  ],
};

function computeWeightedScore(scores: ReviewScores, role: ReviewerRole): number {
  const dims = SCORE_DIMENSIONS[role];
  return dims.reduce((sum, dim) => {
    const val = scores[dim.key];
    return sum + (val != null ? val * dim.weight : 0);
  }, 0);
}

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

const ROLE_LABELS: Record<ReviewerRole, string> = { user: '用户评委', business: '业务评委', tech: '技术评委' };

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

  const allDimLabels = Object.values(SCORE_DIMENSIONS).flat().map((d) => d.label);
  const header = ['方案编号', '方案名称', '方案ID', '评审人', '部门', '评委角色', ...allDimLabels, '总分', '评语', '评审时间'].join(',');

  const rows = (reviews || []).map((r) => {
    const role: ReviewerRole | null = r.reviewer_role;
    const scores: ReviewScores = r.scores ?? {};
    const dimValues = Object.values(SCORE_DIMENSIONS).flat().map((d) => scores[d.key] ?? '');
    const total = role && r.decision === 'reviewed' ? computeWeightedScore(scores, role).toFixed(1) : '';

    return [
      r.proposal_no ?? '',
      `"${(r.title || '').replace(/"/g, '""')}"`,
      r.submission_id,
      r.reviewer?.name || r.reviewer_id,
      r.reviewer?.department || '',
      role ? ROLE_LABELS[role] : '',
      ...dimValues,
      total,
      `"${(r.reason || '').replace(/"/g, '""')}"`,
      r.created_at,
    ].join(',');
  });

  const csv = '\uFEFF' + header + '\n' + rows.join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename=competition_reviews_${new Date().toISOString().slice(0, 10)}.csv`,
    },
  });
}
