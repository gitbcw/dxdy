import { NextRequest, NextResponse } from 'next/server';
import { setAdminSessionCookie } from '@/lib/admin-api-auth';
import { callCloudBaseTool } from '@/lib/cloudbase-mcp';
import type { AdminRole, AdminUser } from '@/lib/types';

export const runtime = 'nodejs';

type CloudUser = Record<string, unknown> & {
  _id?: string;
  username?: string;
  password?: string;
  role?: string;
  status?: string;
};

type ToolListResponse = {
  data?: CloudUser[];
};

const adminRoles: AdminRole[] = ['service', 'product_manager', 'system_admin'];

const defaultAccounts = [
  {
    _id: 'admin_001',
    username: 'service',
    password: 'hashed_password_service',
    realName: '吴晓燕',
    nickname: '吴晓燕',
    phone: '13855001100',
    avatar: '',
    role: 'service',
    permissions: { view_dashboard: true, manage_orders: true, manage_returns: true },
    status: 'active',
  },
  {
    _id: 'admin_002',
    username: 'product_manager',
    password: 'hashed_password_product',
    realName: '陈伟',
    nickname: '陈伟',
    phone: '13866002200',
    avatar: '',
    role: 'product_manager',
    permissions: { view_dashboard: true, manage_products: true },
    status: 'active',
  },
  {
    _id: 'admin_003',
    username: 'system_admin',
    password: 'hashed_password_system',
    realName: '黄建华',
    nickname: '黄建华',
    phone: '13877003300',
    avatar: '',
    role: 'system_admin',
    permissions: {
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
    status: 'active',
  },
];

function normalizeUser(doc: CloudUser): AdminUser {
  const role = adminRoles.includes(doc.role as AdminRole) ? doc.role as AdminRole : 'service';
  return {
    id: String(doc._id || ''),
    username: String(doc.username || ''),
    password: '',
    realName: String(doc.realName || doc.nickname || doc.username || ''),
    phone: String(doc.phone || ''),
    role,
    permissions: typeof doc.permissions === 'object' && doc.permissions ? doc.permissions as Record<string, boolean> : {},
    status: doc.status === 'disabled' ? 'disabled' : 'active',
  };
}

async function readAdminUsers(username?: string) {
  const response = await callCloudBaseTool<ToolListResponse | CloudUser[]>('readNoSqlDatabaseContent', {
    collectionName: 'users',
    limit: username ? 1 : 500,
    query: username ? { username } : undefined,
  });
  const records = !Array.isArray(response) && Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
  return records.filter(item => adminRoles.includes(item.role as AdminRole));
}

async function ensureDefaultAccounts() {
  const existing = await readAdminUsers();
  const now = new Date().toISOString();
  for (const account of defaultAccounts) {
    const exists = existing.some(user => user.username === account.username);
    if (exists) continue;
    await callCloudBaseTool('writeNoSqlDatabaseContent', {
      action: 'update',
      collectionName: 'users',
      query: { _id: account._id },
      update: { $set: { ...account, createdAt: now, updatedAt: now } },
      upsert: true,
    });
  }
}

function isAnyPasswordAllowed() {
  return process.env.ADMIN_ALLOW_ANY_PASSWORD === 'true' || process.env.NODE_ENV !== 'production';
}

function verifyPassword(user: CloudUser, password: string) {
  if (isAnyPasswordAllowed()) return true;
  const stored = String(user.password || '');
  if (!stored || stored.startsWith('hashed_password_')) return false;
  return stored === password;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { username?: string; password?: string };
    const username = String(body.username || '').trim();
    if (!username) return NextResponse.json({ success: false, error: '请输入账号' }, { status: 400 });

    await ensureDefaultAccounts();
    const user = (await readAdminUsers(username))[0];
    if (!user || user.status === 'disabled') {
      return NextResponse.json({ success: false, error: '账号不存在或已禁用' }, { status: 401 });
    }
    if (!verifyPassword(user, String(body.password || ''))) {
      return NextResponse.json({ success: false, error: '账号或密码错误' }, { status: 401 });
    }

    const adminUser = normalizeUser(user);
    const response = NextResponse.json({ success: true, user: adminUser });
    setAdminSessionCookie(response, adminUser.id);
    return response;
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '登录失败' }, { status: 500 });
  }
}
