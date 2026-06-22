import { NextResponse } from 'next/server';
import { getActiveFieldMap } from '@/lib/bitable/field-map-reader';
import { collectFieldOptions } from '@/lib/bitable/metrics';
import { buildDepartmentOptions } from '@/lib/resources/departments';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const BASE_APP = 'LRROwulJciI7JYkIT55cQtdpnze';
const TABLE_ID = 'tbl9WJyxl9bbtYjb';

interface CompetitionTeamRow {
  team: string[] | string | null;
}

function rowToTeams(row: CompetitionTeamRow): string[] {
  if (Array.isArray(row.team)) return row.team;
  if (typeof row.team === 'string') return [row.team];
  return [];
}

export async function GET() {
  try {
    const fieldMap = await getActiveFieldMap(BASE_APP, TABLE_ID, 'wish-pool');
    const fieldOptions = collectFieldOptions(fieldMap);

    const { data: teamRows } = await getSupabaseAdmin()
      .from('competition_submissions')
      .select('team')
      .not('team', 'is', null);

    const fallbackTeams = ((teamRows ?? []) as CompetitionTeamRow[]).map(rowToTeams);
    const departments = buildDepartmentOptions(fieldOptions.team, fallbackTeams);

    return NextResponse.json({ departments });
  } catch (err) {
    console.error('[resources/departments] failed:', err);
    return NextResponse.json({ departments: [] }, { status: 500 });
  }
}
