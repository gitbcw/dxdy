import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-auth';
import { callCloudBaseTool } from '@/lib/cloudbase-mcp';
import type { OperationLog } from '@/lib/types';

export const runtime = 'nodejs';

type CloudDoc = Record<string, unknown> & {
  _id?: string;
  createdAt?: string;
};

type ToolListResponse = {
  data?: CloudDoc[];
};

function normalizeDoc(doc: CloudDoc): OperationLog {
  const { _id, _openid: ignoredOpenid, ...rest } = doc;
  void ignoredOpenid;
  return {
    id: String(_id || rest.id || ''),
    operatorId: String(rest.operatorId || ''),
    operatorName: String(rest.operatorName || '未知操作人'),
    operatorRole: String(rest.operatorRole || ''),
    action: String(rest.action || ''),
    target: String(rest.target || ''),
    detail: String(rest.detail || ''),
    result: rest.result === 'failure' ? 'failure' : 'success',
    ip: rest.ip ? String(rest.ip) : undefined,
    createdAt: String(rest.createdAt || ''),
  };
}

export async function GET(request: Request) {
  const { response } = await requireAdmin(request, { roles: ['system_admin'] });
  if (response) return response;
  try {
    const response = await callCloudBaseTool<ToolListResponse | CloudDoc[]>('readNoSqlDatabaseContent', {
      collectionName: 'logs',
      limit: 500,
      sort: [{ key: 'createdAt', direction: -1 }],
    });
    const records = !Array.isArray(response) && Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
    return NextResponse.json({ logs: records.map(normalizeDoc) });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '读取操作日志失败' }, { status: 500 });
  }
}
