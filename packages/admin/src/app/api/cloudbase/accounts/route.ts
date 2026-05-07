import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-auth';
import { writeAdminLog } from '@/lib/admin-log';
import { callCloudBaseTool } from '@/lib/cloudbase-mcp';
import type { AdminRole, AdminUser } from '@/lib/types';

export const runtime = 'nodejs';

type CloudUser = Record<string, unknown> & {
  _id?: string;
  username?: string;
  role?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ToolListResponse = {
  data?: CloudUser[];
};

const adminRoles: AdminRole[] = ['service', 'product_manager', 'system_admin'];

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

function normalizeUser(doc: CloudUser): AdminUser {
  const { _id, _openid: ignoredOpenid, boundOpenid: ignoredBoundOpenid, ...rest } = doc;
  void ignoredOpenid;
  void ignoredBoundOpenid;
  const role = adminRoles.includes(rest.role as AdminRole) ? rest.role as AdminRole : 'service';
  return {
    id: String(_id || rest.id || ''),
    username: String(rest.username || ''),
    password: String(rest.password || ''),
    realName: String(rest.realName || rest.nickname || rest.username || ''),
    phone: String(rest.phone || ''),
    role,
    permissions: typeof rest.permissions === 'object' && rest.permissions ? rest.permissions as Record<string, boolean> : defaultPermissions[role],
    status: rest.status === 'disabled' ? 'disabled' : 'active',
  };
}

function sortByRecent(a: CloudUser, b: CloudUser) {
  return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
}

async function readAdminAccounts() {
  const response = await callCloudBaseTool<ToolListResponse | CloudUser[]>('readNoSqlDatabaseContent', {
    collectionName: 'users',
    limit: 500,
  });
  const records = !Array.isArray(response) && Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
  return records
    .filter(user => adminRoles.includes(user.role as AdminRole))
    .sort(sortByRecent)
    .map(normalizeUser);
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request, { roles: ['system_admin'] });
  if (response) return response;
  try {
    const accounts = await readAdminAccounts();
    return NextResponse.json({ accounts });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '读取后台账号失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { response, user } = await requireAdmin(request, { roles: ['system_admin'] });
  if (response) return response;
  try {
    const body = await request.json() as Partial<AdminUser>;
    const username = String(body.username || '').trim();
    const role = adminRoles.includes(body.role as AdminRole) ? body.role as AdminRole : 'service';
    if (!username) return NextResponse.json({ error: '用户名不能为空' }, { status: 400 });
    const accounts = await readAdminAccounts();
    if (accounts.some(account => account.username === username)) {
      return NextResponse.json({ error: '用户名已存在' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const id = `admin_${Date.now().toString(36)}`;
    const account = {
      _id: id,
      username,
      password: body.password || 'hashed_password',
      realName: String(body.realName || username),
      nickname: String(body.realName || username),
      phone: String(body.phone || ''),
      avatar: '',
      role,
      permissions: defaultPermissions[role],
      status: body.status || 'active',
      createdAt: now,
      updatedAt: now,
    };
    await callCloudBaseTool('writeNoSqlDatabaseContent', {
      action: 'insert',
      collectionName: 'users',
      documents: [account],
    });
    await writeAdminLog({ operator: user, action: '后台账号创建', target: id, detail: `创建后台账号「${username}」，角色 ${role}` });
    return NextResponse.json({ account: normalizeUser(account) });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '创建后台账号失败' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { response, user } = await requireAdmin(request, { roles: ['system_admin'] });
  if (response) return response;
  try {
    const body = await request.json() as { id?: string; updates?: Partial<AdminUser> };
    const id = String(body.id || '').trim();
    if (!id) return NextResponse.json({ error: '账号参数缺失' }, { status: 400 });
    const updates = body.updates || {};
    const role = adminRoles.includes(updates.role as AdminRole) ? updates.role as AdminRole : undefined;
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (updates.realName !== undefined) {
      updateData.realName = String(updates.realName || '');
      updateData.nickname = String(updates.realName || '');
    }
    if (updates.phone !== undefined) updateData.phone = String(updates.phone || '');
    if (updates.status !== undefined) updateData.status = updates.status === 'disabled' ? 'disabled' : 'active';
    if (updates.password) updateData.password = String(updates.password);
    if (role) {
      updateData.role = role;
      updateData.permissions = defaultPermissions[role];
    }

    await callCloudBaseTool('writeNoSqlDatabaseContent', {
      action: 'update',
      collectionName: 'users',
      query: { _id: id },
      update: { $set: updateData },
    });
    const changes = Object.keys(updateData).filter(key => key !== 'updatedAt').join('、') || '基础信息';
    const action = updateData.status === 'disabled' ? '后台账号禁用' : updateData.status === 'active' ? '后台账号启用' : '后台账号更新';
    await writeAdminLog({ operator: user, action, target: id, detail: `更新后台账号「${id}」：${changes}` });
    const account = (await readAdminAccounts()).find(item => item.id === id) || null;
    return NextResponse.json({ account });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '更新后台账号失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { response, user } = await requireAdmin(request, { roles: ['system_admin'] });
  if (response) return response;
  try {
    const id = request.nextUrl.searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: '账号参数缺失' }, { status: 400 });
    if (id === user?.id) return NextResponse.json({ error: '不能删除当前登录账号' }, { status: 400 });
    await callCloudBaseTool('writeNoSqlDatabaseContent', {
      action: 'delete',
      collectionName: 'users',
      query: { _id: id },
    });
    await writeAdminLog({ operator: user, action: '后台账号删除', target: id, detail: `删除后台账号「${id}」` });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '删除后台账号失败' }, { status: 500 });
  }
}
