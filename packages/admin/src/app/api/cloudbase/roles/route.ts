import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-auth';
import { writeAdminLog } from '@/lib/admin-log';
import { callCloudBaseTool } from '@/lib/cloudbase-mcp';
import type { AdminRole } from '@/lib/types';

export const runtime = 'nodejs';

type CloudUser = Record<string, unknown> & {
  _id?: string;
  role?: string;
  permissions?: Record<string, boolean>;
};

type ToolListResponse = {
  data?: CloudUser[];
};

const roles: AdminRole[] = ['service', 'product_manager', 'system_admin'];

const defaultPermissions: Record<AdminRole, Record<string, boolean>> = {
  service: { view_dashboard: true, manage_orders: true, manage_returns: true },
  product_manager: { view_dashboard: true, manage_products: true },
  system_admin: {
    view_dashboard: true,
    manage_products: true,
    manage_orders: true,
    manage_returns: true,
    manage_users: true,
    manage_accounts: true,
    manage_roles: true,
    manage_system: true,
    view_logs: true,
  },
};

async function readAdminUsers() {
  const response = await callCloudBaseTool<ToolListResponse | CloudUser[]>('readNoSqlDatabaseContent', {
    collectionName: 'users',
    limit: 500,
  });
  const records = !Array.isArray(response) && Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
  return records.filter(user => roles.includes(user.role as AdminRole));
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request, { roles: ['system_admin'] });
  if (response) return response;
  try {
    const users = await readAdminUsers();
    const permissions = { ...defaultPermissions } as Record<AdminRole, Record<string, boolean>>;
    const counts = { service: 0, product_manager: 0, system_admin: 0 } as Record<AdminRole, number>;
    for (const role of roles) {
      const roleUsers = users.filter(user => user.role === role);
      counts[role] = roleUsers.length;
      const userWithPermissions = roleUsers.find(user => user.permissions && Object.keys(user.permissions).length > 0);
      if (userWithPermissions?.permissions) permissions[role] = userWithPermissions.permissions;
    }
    return NextResponse.json({ permissions, counts });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '读取角色权限失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { response, user } = await requireAdmin(request, { roles: ['system_admin'] });
  if (response) return response;
  try {
    const body = await request.json() as { role?: AdminRole; permissions?: Record<string, boolean> };
    const role = roles.includes(body.role as AdminRole) ? body.role as AdminRole : null;
    if (!role || !body.permissions) return NextResponse.json({ error: '角色权限参数缺失' }, { status: 400 });
    await callCloudBaseTool('writeNoSqlDatabaseContent', {
      action: 'update',
      collectionName: 'users',
      query: { role },
      isMulti: true,
      update: { $set: { permissions: body.permissions, updatedAt: new Date().toISOString() } },
    });
    await writeAdminLog({
      operator: user,
      action: '角色权限更新',
      target: role,
      detail: `更新「${role}」角色权限，启用 ${Object.values(body.permissions).filter(Boolean).length} 项权限`,
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '保存角色权限失败' }, { status: 500 });
  }
}
