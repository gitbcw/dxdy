import type { AdminRole } from '@/lib/types'

export const routeAccess: Record<string, AdminRole[]> = {
  dashboard: ['system_admin'],
  products: ['product_manager', 'system_admin'],
  articles: ['product_manager', 'system_admin'],
  orders: ['service', 'system_admin', 'clerk'],
  returns: ['service', 'system_admin', 'clerk'],
  finance: ['service', 'system_admin'],
  users: ['system_admin'],
  accounts: ['system_admin'],
  roles: ['system_admin'],
  system: ['system_admin'],
  coupons: ['system_admin'],
  commissions: ['system_admin'],
  cards: ['system_admin'],
  reviews: ['system_admin'],
  logs: ['system_admin'],
}

export function getLandingPath(role: AdminRole) {
  if (role === 'system_admin') return '/dashboard'
  if (role === 'product_manager') return '/products'
  return '/orders'
}
