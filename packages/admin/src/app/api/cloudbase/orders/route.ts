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

type FunctionResult = {
  success?: boolean;
  error?: string;
  order?: unknown;
};

function normalizeDoc(doc: CloudDoc) {
  const { _id, _openid: ignoredOpenid, ...rest } = doc;
  void ignoredOpenid;
  return { id: _id, ...rest };
}

function sortByRecent(a: CloudDoc, b: CloudDoc) {
  return String(b.createdAt || b.updatedAt || '').localeCompare(String(a.createdAt || a.updatedAt || ''));
}

async function readOrders(id?: string) {
  const response = await callCloudBaseTool<ToolListResponse | CloudDoc[]>('readNoSqlDatabaseContent', {
    collectionName: 'orders',
    limit: id ? 1 : 500,
    query: id ? { _id: id } : undefined,
  });
  const records = !Array.isArray(response) && Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
  return records.map(normalizeDoc).sort(sortByRecent);
}

async function readClerks() {
  const response = await callCloudBaseTool<ToolListResponse | CloudDoc[]>('readNoSqlDatabaseContent', {
    collectionName: 'users',
    limit: 500,
    query: { role: 'clerk' },
  });
  const records = !Array.isArray(response) && Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
  return records.map(normalizeDoc).sort(sortByRecent);
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request, { roles: ['service', 'system_admin'], permissions: ['manage_orders'] });
  if (response) return response;
  try {
    const id = request.nextUrl.searchParams.get('id') || '';
    const orders = await readOrders(id || undefined);
    if (id) {
      const order = orders[0] || null;
      if (!order) return NextResponse.json({ error: '订单不存在' }, { status: 404 });
      return NextResponse.json({ order });
    }
    const clerks = await readClerks();
    return NextResponse.json({ orders, clerks });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '读取订单数据失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { response, user } = await requireAdmin(request, { roles: ['service', 'system_admin'], permissions: ['manage_orders'] });
  if (response) return response;
  try {
    const body = await request.json() as {
      action?: string;
      orderId?: string;
      status?: string;
      newPrice?: number;
      clerkId?: string;
      company?: string;
      trackingNo?: string;
      operatorId?: string;
      operatorName?: string;
    };
    const orderId = String(body.orderId || '').trim();
    if (!orderId) return NextResponse.json({ error: '订单参数缺失' }, { status: 400 });

    const action = String(body.action || '').trim();
    const functionName = action === 'adjust_price'
      ? 'adjustOrderPrice'
      : action === 'assign'
        ? 'assignOrderToClerk'
        : action === 'ship'
          ? 'clerkShipOrder'
          : action === 'status'
            ? 'updateOrderStatus'
            : '';
    if (!functionName) return NextResponse.json({ error: '订单处理类型无效' }, { status: 400 });
    const actionLabel = action === 'adjust_price'
      ? '订单改价'
      : action === 'assign'
        ? '订单分配'
        : action === 'ship'
          ? '订单发货'
          : '订单状态更新';

    const response = await callCloudBaseTool<{
      data?: FunctionResult;
      result?: FunctionResult;
      success?: boolean;
      error?: string;
      order?: unknown;
    }>('manageFunctions', {
      action: 'invokeFunction',
      functionName,
      params: {
        orderId,
        status: body.status,
        newPrice: body.newPrice,
        clerkId: String(body.clerkId || ''),
        company: String(body.company || ''),
        trackingNo: String(body.trackingNo || ''),
        operatorId: String(body.operatorId || user?.id || ''),
        operatorName: String(body.operatorName || user?.realName || user?.username || ''),
      },
    });
    const result = unwrapCloudFunctionResult(response) as FunctionResult;
    if (result && result.success === false) {
      return NextResponse.json({ error: result.error || '订单处理失败' }, { status: 400 });
    }
    await writeAdminLog({
      operator: user,
      action: actionLabel,
      target: orderId,
      detail: `处理订单「${orderId}」：${actionLabel}${body.status ? `，状态 ${body.status}` : ''}${body.newPrice !== undefined ? `，新价格 ${body.newPrice}` : ''}`,
    });
    return NextResponse.json(result || { success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '订单处理失败' }, { status: 500 });
  }
}
