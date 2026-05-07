import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-auth';
import { callCloudBaseTool } from '@/lib/cloudbase-mcp';

export const runtime = 'nodejs';

type CloudUser = Record<string, unknown> & {
  _id?: string;
  role?: string;
  agentStatus?: string;
  updatedAt?: string;
  createdAt?: string;
};

type UsersToolResponse = {
  data?: CloudUser[];
};

function normalizeUser(doc: CloudUser) {
  if (!doc) return doc;
  const { _id, _openid: _ignoredOpenid, ...rest } = doc;
  void _ignoredOpenid;
  return { id: _id, ...rest };
}

function sortByUpdatedAt(a: CloudUser, b: CloudUser) {
  return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
}

export async function GET(request: Request) {
  const { response } = await requireAdmin(request, { roles: ['system_admin'] });
  if (response) return response;
  try {
    const response = await callCloudBaseTool<UsersToolResponse | CloudUser[]>('readNoSqlDatabaseContent', {
      collectionName: 'users',
      limit: 500,
    });
    const records = !Array.isArray(response) && Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
    const users = records.map(normalizeUser);
    return NextResponse.json({
      customers: users.filter((user) => user.role === 'customer').sort(sortByUpdatedAt),
      salespersons: users.filter((user) => user.role === 'salesperson').sort(sortByUpdatedAt),
      agentApplications: users.filter((user) => user.agentStatus === 'pending_review').sort(sortByUpdatedAt),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '读取用户失败' }, { status: 500 });
  }
}
