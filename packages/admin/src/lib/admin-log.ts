import { callCloudBaseTool } from '@/lib/cloudbase-mcp';
import type { ApiAdminUser } from '@/lib/admin-api-auth';

export type AdminLogInput = {
  operator?: ApiAdminUser | null;
  action: string;
  target: string;
  detail: string;
  result?: 'success' | 'failure';
};

export async function writeAdminLog(input: AdminLogInput) {
  await callCloudBaseTool('writeNoSqlDatabaseContent', {
    action: 'insert',
    collectionName: 'logs',
    documents: [{
      operatorId: input.operator?.id || 'unknown',
      operatorName: input.operator?.realName || input.operator?.username || '未知操作人',
      operatorRole: input.operator?.role || 'unknown',
      action: input.action,
      target: input.target,
      detail: input.detail,
      result: input.result || 'success',
      createdAt: new Date().toISOString(),
    }],
  });
}
