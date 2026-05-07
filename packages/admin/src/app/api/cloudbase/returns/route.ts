import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-auth';
import { writeAdminLog } from '@/lib/admin-log';
import { callCloudBaseTool } from '@/lib/cloudbase-mcp';
import { unwrapCloudFunctionResult } from '@/lib/cloudbase-function-result';

export const runtime = 'nodejs';

type CloudDoc = Record<string, unknown> & {
  _id?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ToolListResponse = {
  data?: CloudDoc[];
};

function normalizeDoc(doc: CloudDoc) {
  const { _id, _openid: ignoredOpenid, ...rest } = doc;
  void ignoredOpenid;
  return { id: _id, ...rest };
}

function sortByRecent(a: CloudDoc, b: CloudDoc) {
  return String(b.createdAt || b.updatedAt || '').localeCompare(String(a.createdAt || a.updatedAt || ''));
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request, { roles: ['service', 'system_admin'], permissions: ['manage_returns'] });
  if (response) return response;
  try {
    const response = await callCloudBaseTool<ToolListResponse | CloudDoc[]>('readNoSqlDatabaseContent', {
      collectionName: 'returns',
      limit: 500,
    });
    const records = !Array.isArray(response) && Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
    const returns = records.map(normalizeDoc).sort(sortByRecent);
    return NextResponse.json({ returns });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '读取售后数据失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { response, user } = await requireAdmin(request, { roles: ['service', 'system_admin'], permissions: ['manage_returns'] });
  if (response) return response;
  try {
    const body = await request.json() as {
      id?: string;
      status?: string;
      approved?: boolean;
      note?: string;
      operatorId?: string;
      operatorName?: string;
    };
    if (!body.id) return NextResponse.json({ error: '售后单参数缺失' }, { status: 400 });

    const response = await callCloudBaseTool<{
      data?: { success?: boolean; error?: string; record?: unknown };
      result?: { success?: boolean; error?: string; record?: unknown };
      success?: boolean;
      error?: string;
      record?: unknown;
    }>('manageFunctions', {
      action: 'invokeFunction',
      functionName: 'reviewReturn',
      params: {
        id: body.id,
        status: body.status,
        approved: body.approved,
        note: String(body.note || ''),
        operatorId: String(body.operatorId || user?.id || ''),
        operatorName: String(body.operatorName || user?.realName || user?.username || ''),
      },
    });
    const result = unwrapCloudFunctionResult(response) as { success?: boolean; error?: string; record?: unknown };
    if (result && result.success === false) {
      return NextResponse.json({ error: result.error || '售后处理失败' }, { status: 400 });
    }
    await writeAdminLog({
      operator: user,
      action: '售后审核',
      target: String(body.id),
      detail: `处理售后单「${body.id}」：${body.approved === false ? '驳回' : '通过'}${body.status ? `，状态 ${body.status}` : ''}${body.note ? `，备注：${body.note}` : ''}`,
    });
    return NextResponse.json(result || { success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '售后处理失败' }, { status: 500 });
  }
}
