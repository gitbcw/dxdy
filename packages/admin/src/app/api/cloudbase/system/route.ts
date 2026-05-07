import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-auth';
import { writeAdminLog } from '@/lib/admin-log';
import { callCloudBaseTool } from '@/lib/cloudbase-mcp';
import { defaultSystemConfig } from '@/lib/format';
import type { SystemConfig } from '@/lib/types';

export const runtime = 'nodejs';

type CloudDoc = Record<string, unknown> & {
  _id?: string;
};

type ToolListResponse = {
  data?: CloudDoc[];
};

function normalizeDoc(doc: CloudDoc) {
  const { _id, _openid: ignoredOpenid, ...rest } = doc;
  void ignoredOpenid;
  return { id: _id, ...rest };
}

async function readSystemConfig() {
  const response = await callCloudBaseTool<ToolListResponse | CloudDoc[]>('readNoSqlDatabaseContent', {
    collectionName: 'config',
    limit: 1,
    query: { _id: 'system' },
  });
  const records = !Array.isArray(response) && Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
  return records[0] ? normalizeDoc(records[0]) : null;
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request, { roles: ['system_admin'] });
  if (response) return response;
  try {
    const config = await readSystemConfig();
    return NextResponse.json({ config: config || defaultSystemConfig });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '读取系统配置失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { response, user } = await requireAdmin(request, { roles: ['system_admin'] });
  if (response) return response;
  try {
    const body = await request.json() as Partial<SystemConfig>;
    const { id: ignoredId, ...payload } = body as Partial<SystemConfig> & { id?: string };
    void ignoredId;
    const now = new Date().toISOString();
    const existing = await readSystemConfig();
    if (existing) {
      await callCloudBaseTool('writeNoSqlDatabaseContent', {
        action: 'update',
        collectionName: 'config',
        query: { _id: 'system' },
        update: { $set: { ...payload, updatedAt: now } },
      });
    } else {
      await callCloudBaseTool('writeNoSqlDatabaseContent', {
        action: 'insert',
        collectionName: 'config',
        documents: [{ _id: 'system', ...defaultSystemConfig, ...payload, createdAt: now, updatedAt: now }],
      });
    }
    const config = await readSystemConfig();
    await writeAdminLog({
      operator: user,
      action: '系统配置保存',
      target: 'system',
      detail: `保存系统配置：${Object.keys(payload).join('、') || '无字段变更'}`,
    });
    return NextResponse.json({ config: config || { ...defaultSystemConfig, ...payload } });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '保存系统配置失败' }, { status: 500 });
  }
}
