import type { AdminProfile } from '@/hooks/use-auth'
import type { AdminRole } from '@/lib/types'

const ADMIN_ROLES: AdminRole[] = ['service', 'product_manager', 'system_admin', 'clerk']

export type CloudUser = Record<string, unknown> & {
  _id?: string
  username?: string
  realName?: string
  role?: string
  status?: string
  permissions?: Record<string, boolean>
  password?: string
}

export function normalizeProfile(doc: CloudUser, fallbackId = ''): AdminProfile | null {
  if (!doc || !ADMIN_ROLES.includes(doc.role as AdminRole) || doc.status === 'disabled') return null
  return {
    id: String(doc._id || fallbackId),
    username: String(doc.username || ''),
    realName: String(doc.realName || doc.username || fallbackId),
    role: doc.role as AdminRole,
    permissions: doc.permissions || {},
    status: doc.status === 'disabled' ? 'disabled' : 'active',
  }
}

export function getLoginLandingPath(role: AdminRole) {
  if (role === 'system_admin') return '/dashboard'
  if (role === 'product_manager') return '/products'
  return '/orders'
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  return atob(padded)
}

export function hasUsableToken(profile: { token?: unknown } | null | undefined) {
  if (!profile || typeof profile.token !== 'string') return false

  const [body, signature, extra] = profile.token.split('.')
  if (!body || !signature || extra !== undefined) return false

  try {
    const payload = JSON.parse(decodeBase64Url(body)) as { exp?: unknown }
    return typeof payload.exp === 'number' && payload.exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}
