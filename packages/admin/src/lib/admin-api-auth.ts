import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { callCloudBaseTool } from '@/lib/cloudbase-mcp';
import type { AdminRole, AdminUser } from '@/lib/types';

type AdminAuthOptions = {
  roles?: AdminRole[];
  permissions?: string[];
};

type CloudUser = Record<string, unknown> & {
  _id?: string;
  username?: string;
  role?: string;
  status?: string;
};

type ToolListResponse = {
  data?: CloudUser[];
};

type SessionPayload = {
  userId: string;
  issuedAt: number;
  expiresAt: number;
};

export type ApiAdminUser = Pick<AdminUser, 'id' | 'username' | 'realName' | 'role' | 'permissions' | 'status'>;

export const ADMIN_SESSION_COOKIE = 'admin_session';
const adminRoles: AdminRole[] = ['service', 'product_manager', 'system_admin'];
const sessionMaxAgeSeconds = 60 * 60 * 8;

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('生产环境必须配置 ADMIN_SESSION_SECRET');
  }
  return 'dxdy-admin-dev-session-secret';
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value: string) {
  return crypto.createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = cookieHeader.split(';').map(cookie => cookie.trim()).filter(Boolean);
  for (const cookie of cookies) {
    const [key, ...parts] = cookie.split('=');
    if (key === name) return decodeURIComponent(parts.join('='));
  }
  return '';
}

function normalizeUser(doc: CloudUser): ApiAdminUser {
  const role = adminRoles.includes(doc.role as AdminRole) ? doc.role as AdminRole : 'service';
  return {
    id: String(doc._id || doc.id || ''),
    username: String(doc.username || ''),
    realName: String(doc.realName || doc.nickname || doc.username || doc._id || ''),
    role,
    permissions: typeof doc.permissions === 'object' && doc.permissions ? doc.permissions as Record<string, boolean> : {},
    status: doc.status === 'disabled' ? 'disabled' : 'active',
  };
}

async function readAdminUserById(userId: string) {
  const response = await callCloudBaseTool<ToolListResponse | CloudUser[]>('readNoSqlDatabaseContent', {
    collectionName: 'users',
    limit: 1,
    query: { _id: userId },
  });
  const records = !Array.isArray(response) && Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
  const user = records.find(item => adminRoles.includes(item.role as AdminRole));
  return user ? normalizeUser(user) : null;
}

export function createAdminSessionToken(userId: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(JSON.stringify({
    userId,
    issuedAt: now,
    expiresAt: now + sessionMaxAgeSeconds,
  } satisfies SessionPayload));
  return `${payload}.${sign(payload)}`;
}

function parseAdminSessionToken(token: string): SessionPayload | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return null;
  try {
    const data = JSON.parse(base64UrlDecode(payload)) as SessionPayload;
    if (!data.userId || !data.expiresAt || data.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export function setAdminSessionCookie(response: NextResponse, userId: string) {
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sessionMaxAgeSeconds,
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export async function getCurrentAdminUser(request: Request) {
  const token = getCookie(request, ADMIN_SESSION_COOKIE);
  const payload = token ? parseAdminSessionToken(token) : null;
  if (!payload) return null;
  const user = await readAdminUserById(payload.userId);
  if (!user || user.status !== 'active') return null;
  return user;
}

export async function requireAdmin(request: Request, options: AdminAuthOptions = {}) {
  const user = await getCurrentAdminUser(request);
  if (!user) {
    return {
      response: NextResponse.json({ error: '后台登录状态无效，请重新登录' }, { status: 401 }),
      user: null,
    };
  }

  const hasRoleRules = !!options.roles?.length;
  const hasPermissionRules = !!options.permissions?.length;
  const roleAllowed = hasRoleRules && options.roles!.includes(user.role);
  const permissionAllowed = hasPermissionRules && options.permissions!.some(permission => user.permissions?.[permission] === true);
  const allowed = hasRoleRules || hasPermissionRules ? roleAllowed || permissionAllowed : true;
  if (!allowed) {
    return {
      response: NextResponse.json({ error: '无权访问该后台接口' }, { status: 403 }),
      user: null,
    };
  }

  return { response: null, user };
}
