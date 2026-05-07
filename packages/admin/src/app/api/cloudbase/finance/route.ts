import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-auth';
import { writeAdminLog } from '@/lib/admin-log';
import { callCloudBaseTool } from '@/lib/cloudbase-mcp';
import { unwrapCloudFunctionResult } from '@/lib/cloudbase-function-result';

export const runtime = 'nodejs';

type CloudDoc = Record<string, unknown> & {
  _id?: string;
  status?: string;
  appliedAt?: string;
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
  return String(b.appliedAt || b.createdAt || b.updatedAt || '').localeCompare(String(a.appliedAt || a.createdAt || a.updatedAt || ''));
}

async function readCollection(collectionName: string) {
  const response = await callCloudBaseTool<ToolListResponse | CloudDoc[]>('readNoSqlDatabaseContent', {
    collectionName,
    limit: 500,
  });
  const records = !Array.isArray(response) && Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
  return records.map(normalizeDoc).sort(sortByRecent);
}

const functionMap: Record<string, string> = {
  withdrawal: 'reviewWithdrawal',
  invoice: 'processInvoice',
};

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request, { roles: ['service', 'system_admin'] });
  if (response) return response;
  try {
    const [withdrawals, invoices] = await Promise.all([
      readCollection('withdrawals'),
      readCollection('invoices'),
    ]);
    return NextResponse.json({ withdrawals, invoices });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '读取财务数据失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { response, user } = await requireAdmin(request, { roles: ['service', 'system_admin'] });
  if (response) return response;
  try {
    const body = await request.json() as {
      type?: string;
      id?: string;
      status?: string;
      approved?: boolean;
      note?: string;
      invoiceFileID?: string;
      invoiceNo?: string;
      company?: string;
      trackingNo?: string;
      operatorId?: string;
      operatorName?: string;
    };
    const type = String(body.type || '');
    const functionName = functionMap[type];
    if (!functionName) return NextResponse.json({ error: '处理类型无效' }, { status: 400 });
    if (!body.id) return NextResponse.json({ error: '记录参数缺失' }, { status: 400 });

    const response = await callCloudBaseTool<{
      data?: { success?: boolean; error?: string };
      result?: { success?: boolean; error?: string };
      success?: boolean;
      error?: string;
    }>('manageFunctions', {
      action: 'invokeFunction',
      functionName,
      params: {
        id: body.id,
        status: body.status,
        approved: body.approved,
        note: String(body.note || ''),
        invoiceFileID: String(body.invoiceFileID || ''),
        invoiceNo: String(body.invoiceNo || ''),
        company: String(body.company || ''),
        trackingNo: String(body.trackingNo || ''),
        operatorId: String(body.operatorId || user?.id || ''),
        operatorName: String(body.operatorName || user?.realName || user?.username || ''),
      },
    });
    const result = unwrapCloudFunctionResult(response);
    if (result && result.success === false) {
      return NextResponse.json({ error: result.error || '处理失败' }, { status: 400 });
    }
    await writeAdminLog({
      operator: user,
      action: type === 'withdrawal' ? '提现审核' : '发票处理',
      target: String(body.id),
      detail: `处理${type === 'withdrawal' ? '提现' : '发票'}记录「${body.id}」${body.status ? `，状态 ${body.status}` : ''}${body.note ? `，备注：${body.note}` : ''}`,
    });
    return NextResponse.json(result || { success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '处理失败' }, { status: 500 });
  }
}
