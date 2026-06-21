import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// POST /api/admin/reviews/cleanup
// 清理"并入其他方案"的方案及其关联评审记录
export async function POST(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  if (!(await hasPermission(userId, 'review.clear-reviewer'))) {
    return NextResponse.json({ error: '仅管理员可执行清理' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();

  // 1. 查找"并入其他方案"的方案
  const { data: mergedSubmissions, error: queryError } = await admin
    .from('competition_submissions')
    .select('id, proposal_no, title, status')
    .eq('status', '并入其他方案');

  if (queryError) {
    return NextResponse.json({ error: `查询失败: ${queryError.message}` }, { status: 500 });
  }

  if (!mergedSubmissions || mergedSubmissions.length === 0) {
    return NextResponse.json({ message: '没有需要清理的记录', deletedReviews: 0, deletedSubmissions: 0 });
  }

  const mergedIds = mergedSubmissions.map((s: { id: string }) => s.id);

  // 2. 删除关联评审记录
  const { count: reviewCount, error: reviewError } = await admin
    .from('competition_reviews')
    .delete({ count: 'exact' })
    .in('submission_id', mergedIds);

  if (reviewError) {
    return NextResponse.json({ error: `删除评审记录失败: ${reviewError.message}` }, { status: 500 });
  }

  // 3. 删除方案记录
  const { count: submissionCount, error: submissionError } = await admin
    .from('competition_submissions')
    .delete({ count: 'exact' })
    .in('id', mergedIds);

  if (submissionError) {
    return NextResponse.json({ error: `删除方案失败: ${submissionError.message}` }, { status: 500 });
  }

  return NextResponse.json({
    message: '清理完成',
    mergedSubmissions: mergedSubmissions.map((s: { id: string; proposal_no: number | null; title: string }) => ({ id: s.id, proposalNo: s.proposal_no, title: s.title })),
    deletedReviews: reviewCount ?? 0,
    deletedSubmissions: submissionCount ?? 0,
  });
}
