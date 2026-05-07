import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-auth';
import { callCloudBaseTool } from '@/lib/cloudbase-mcp';
import { defaultSystemConfig } from '@/lib/format';

export const runtime = 'nodejs';

type CloudDoc = Record<string, unknown> & {
  _id?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ToolListResponse = {
  data?: CloudDoc[];
};

function normalizeDoc(doc: CloudDoc): CloudDoc & { id?: string } {
  const { _id, _openid: ignoredOpenid, ...rest } = doc;
  void ignoredOpenid;
  return { id: _id, ...rest };
}

function sortByRecent(a: CloudDoc, b: CloudDoc) {
  return String(b.createdAt || b.updatedAt || '').localeCompare(String(a.createdAt || a.updatedAt || ''));
}

async function readCollection(collectionName: string, query?: Record<string, unknown>) {
  const response = await callCloudBaseTool<ToolListResponse | CloudDoc[]>('readNoSqlDatabaseContent', {
    collectionName,
    limit: 500,
    query,
  });
  const records = !Array.isArray(response) && Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
  return records.map(normalizeDoc).sort(sortByRecent);
}

export async function GET(request: Request) {
  const { response } = await requireAdmin(request, { roles: ['system_admin'] });
  if (response) return response;
  try {
    const [orders, returns, products, users, configRecords] = await Promise.all([
      readCollection('orders'),
      readCollection('returns'),
      readCollection('products'),
      readCollection('users'),
      readCollection('config', { _id: 'system' }),
    ]);
    return NextResponse.json({
      orders,
      returns,
      products,
      customers: users.filter(user => user.role === 'customer'),
      config: configRecords[0] || defaultSystemConfig,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '读取仪表盘数据失败' }, { status: 500 });
  }
}
