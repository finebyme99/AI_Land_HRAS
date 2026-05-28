import { NextRequest, NextResponse } from 'next/server';
import { getTenantAccessToken } from '@/lib/feishu';

const BASE_APP = 'Hc6DbL3Wia2ejMsQn7TcE9g2njc';
const TABLE_ID = 'tbl12tkH7lOR9rrq';
const FEISHU_API = 'https://open.feishu.cn/open-apis';

// 飞书字段名 → 前端字段名映射
const FIELD_NAME_MAP: Record<string, string> = {
  '方案标题_AI': 'title',
  '提交人': 'submitter',
  '提报人团队': 'team',
  '请选择提报赛道': 'track',
  '提效/增值场景分类': 'sceneCategory',
  'AI工具': 'aiTools',
  '提报提效比例': 'efficiencyRate',
  '提报月均节省工时': 'monthlySavedHours',
  '原场景与流程': 'beforeProcess',
  '核心痛点': 'painPoints',
  '现工作流程': 'afterProcess',
  '原人均每月投入工时': 'beforeHoursPerPerson',
  '原月均投入人数': 'beforePeopleCount',
  '现人均每月投入工时': 'afterHoursPerPerson',
  '现月均投入人数': 'afterPeopleCount',
  '月均任务消耗AI费用': 'aiCost',
  '其他价值：准确率提升 / 质量提升 / 员工体验提升 等': 'extraValue',
  '工时数据真实性确认人': 'verifier',
  '补充说明：方案说明SOP文档链接、GitHub仓库地址等': 'sourceUrl',
  '评审周期': 'period',
  '组队团队成员': 'teamMembers',
  '赛事进展': 'status',
  '补充附件：效果示意图/视频/相关源文件': 'attachments',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecord(record: any): Record<string, unknown> {
  const mapped: Record<string, unknown> = {
    id: record.record_id,
    recordUrl: `https://ztn.feishu.cn/base/${BASE_APP}?table=${TABLE_ID}&record=${record.record_id}`,
  };
  for (const [fieldName, value] of Object.entries(record.fields ?? {})) {
    const key = FIELD_NAME_MAP[fieldName];
    if (!key) continue;
    if (value == null) continue;

    // text field: [{type:'text', text:'...'}] → string
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && 'text' in value[0]) {
      mapped[key] = value.map((v: { text?: string }) => v.text ?? '').join('');
    }
    // user field: [{id, name}] or {id, name} → string[]
    else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && 'name' in value[0]) {
      mapped[key] = value.map((v: { name?: string }) => v.name ?? '');
    }
    else if (typeof value === 'object' && value !== null && 'name' in value) {
      mapped[key] = [(value as { name?: string }).name ?? ''];
    }
    // attachment field: [{file_token, name, size, type}] → normalized
    else if (key === 'attachments' && Array.isArray(value)) {
      mapped[key] = value
        .filter((v: { file_token?: string }) => v.file_token)
        .map((v: { file_token: string; name?: string; size?: number; type?: string }) => ({
          fileToken: v.file_token,
          name: v.name ?? '',
          size: v.size,
          type: v.type,
        }));
    }
    // select multi or painPoints
    else if (Array.isArray(value)) {
      mapped[key] = value;
    }
    else {
      mapped[key] = value;
    }
  }
  return mapped;
}

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get('period') ?? '2605';

  try {
    const token = await getTenantAccessToken();

    // 分页拉取全部记录
    const allItems: Record<string, unknown>[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL(`${FEISHU_API}/bitable/v1/apps/${BASE_APP}/tables/${TABLE_ID}/records`);
      url.searchParams.set('page_size', '100');
      if (pageToken) url.searchParams.set('page_token', pageToken);

      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const json = await res.json();

      if (json.code !== 0) {
        console.error('飞书 Base API 错误:', JSON.stringify(json, null, 2));
        return NextResponse.json({ error: json.msg ?? '飞书 API 错误', code: json.code }, { status: 502 });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = (json.data?.items ?? []).map(mapRecord).filter((r: any) => r.period === period);
      allItems.push(...items);

      pageToken = json.data?.has_more ? json.data.page_token : undefined;
    } while (pageToken);

    return NextResponse.json({ items: allItems, total: allItems.length, period });
  } catch (err) {
    console.error('读取飞书 Base 失败:', err);
    return NextResponse.json({ error: '读取飞书 Base 失败' }, { status: 500 });
  }
}
