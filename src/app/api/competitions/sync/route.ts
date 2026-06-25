import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const BUCKET = 'competition-attachments';

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value == null || value === '') return [];
  return [String(value)];
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function mapAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      const storagePath = typeof item.storage_path === 'string' ? item.storage_path : '';
      return {
        name: typeof item.name === 'string' ? item.name : '',
        type: typeof item.type === 'string' ? item.type : undefined,
        size: toNumber(item.size) ?? undefined,
        url: storagePath && process.env.NEXT_PUBLIC_SUPABASE_URL
          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`
          : undefined,
      };
    });
}

// GET: 从 Supabase 读取已同步的数据。写入型飞书同步已收口到 /api/admin/competition-sync。
export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get('period') ?? '2605';

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('competition_submissions')
      .select('*')
      .eq('period', period)
      .order('monthly_saved_hours', { ascending: false, nullsFirst: false });

    if (error) throw error;

    const items = (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id,
      recordUrl: row.record_url,
      title: row.title,
      submitter: row.submitter,
      teamMembers: row.team_members,
      team: row.team,
      track: row.track,
      sceneCategory: row.scene_category,
      aiTools: row.ai_tools,
      efficiencyRate: row.efficiency_rate,
      monthlySavedHours: row.monthly_saved_hours,
      beforeProcess: row.before_process,
      painPoints: row.pain_points,
      afterProcess: row.after_process,
      beforeHoursPerPerson: row.before_hours_per_person,
      beforePeopleCount: row.before_people_count,
      afterHoursPerPerson: row.after_hours_per_person,
      afterPeopleCount: row.after_people_count,
      aiCost: row.ai_cost,
      extraValue: row.extra_value,
      verifier: row.verifier,
      status: row.status,
      proposalNo: row.proposal_no,
      attachments: mapAttachments(row.attachments),
      implementation: row.implementation,
      newOperationCount: row.new_operation_count,
      oldOperationCount: row.old_operation_count,
      teamType: row.team_type,
      oldHoursPerTask: row.old_hours_per_task,
      newDuration: row.new_duration,
      newPeopleCount: row.new_people_count,
      oldPeopleCount: row.old_people_count,
      oldFrequency: row.old_frequency,
      newFrequency: row.new_frequency,
      reviewers: toArray(row.reviewers),
      demoLink: row.demo_link,
      dataSource: row.data_source,
      dataSourceNote: row.data_source_note,
    }));

    return NextResponse.json({ items, total: items.length, period });
  } catch (err) {
    console.error('读取大赛方案失败:', err);
    return NextResponse.json({ error: '读取数据失败' }, { status: 500 });
  }
}
