import { getDb } from '@/lib/cloudbase'
import type {
  AdminRole, AdminUser, Product, ProductCategory, Order,
  ReturnRecord, OperationLog, SystemConfig, User, Customer, Salesperson, Clerk,
  CouponTemplate, UserCoupon,
} from '@/lib/types'
import { defaultSystemConfig } from '@/lib/format'

type CloudDoc = Record<string, unknown>

/** Lazy-access database — avoids top-level CloudBase init during SSR/build */
function db() { return getDb() }

const ADMIN_ROLES: AdminRole[] = ['service', 'product_manager', 'system_admin']

const defaultPermissions: Record<AdminRole, Record<string, boolean>> = {
  service: { view_dashboard: true, manage_orders: true, manage_returns: true },
  product_manager: { view_dashboard: true, manage_products: true },
  system_admin: {
    view_dashboard: true, manage_products: true, manage_orders: true,
    manage_returns: true, manage_users: true, manage_accounts: true,
    manage_roles: true, manage_system: true, view_logs: true,
  },
}

// ===== Helpers =====

function normalizeDoc<T extends CloudDoc>(doc: T): T & { id: string } {
  const { _id, _openid, boundOpenid, ...rest } = doc as any
  return { id: String(_id || ''), ...rest }
}

function sortByRecent<T extends CloudDoc>(a: T, b: T) {
  return String(b.createdAt || b.updatedAt || '').localeCompare(String(a.createdAt || a.updatedAt || ''))
}

async function readCollection<T extends CloudDoc>(name: string, query?: Record<string, unknown>, projection?: Record<string, unknown>): Promise<(T & { id: string })[]> {
  let q = db().collection(name) as any
  if (query && Object.keys(query).length > 0) q = q.where(query)
  if (projection && Object.keys(projection).length > 0) q = q.field(projection)
  const res = await q.orderBy('createdAt', 'desc').limit(500).get()
  const docs: T[] = res.data || []
  return docs.map(normalizeDoc).sort(sortByRecent)
}

function normalizeAdminUser(doc: CloudDoc): AdminUser {
  const role = ADMIN_ROLES.includes(doc.role as AdminRole) ? doc.role as AdminRole : 'service'
  return {
    id: String(doc._id || doc.id || ''),
    username: String(doc.username || ''),
    password: String(doc.password || ''),
    realName: String(doc.realName || doc.nickname || doc.username || ''),
    phone: String(doc.phone || ''),
    role,
    permissions: typeof doc.permissions === 'object' && doc.permissions ? doc.permissions as Record<string, boolean> : defaultPermissions[role],
    status: doc.status === 'disabled' ? 'disabled' : 'active',
  }
}

// ===== Dashboard =====

export async function fetchDashboardData() {
  const [orders, returns, products, users, configRecords] = await Promise.all([
    readCollection('orders'),
    readCollection('returns'),
    readCollection('products'),
    readCollection('users'),
    readCollection('config', { _id: 'system' }),
  ]) as any
  return {
    orders,
    returns,
    products,
    customers: users.filter((u: any) => u.role === 'customer'),
    config: configRecords[0] || defaultSystemConfig,
  }
}

// ===== Products =====

export async function fetchProductsAndCategories() {
  const productProjection = {
    name: 1,
    category: 1,
    institutionPrice: 1,
    personalPrice: 1,
    visibility: 1,
    stock: 1,
    status: 1,
    productType: 1,
    isBloodPack: 1,
    bookingConfig: 1,
    purchaseLimit: 1,
    agreementRequired: 1,
    salesCountEnabled: 1,
    urgentConfig: 1,
    redeemableCategory: 1,
    validDays: 1,
    promotionPrice: 1,
    promotionStart: 1,
    promotionEnd: 1,
    createdAt: 1,
    updatedAt: 1,
  }
  const [products, categories] = await Promise.all([
    readCollection('products', undefined, productProjection),
    readCollection('categories'),
  ]) as any
  return { products, categories }
}

export async function fetchProductById(id: string) {
  const res = await db().collection('products').doc(id).get()
  const data = Array.isArray(res.data) ? res.data[0] : res.data
  return data ? normalizeDoc(data as CloudDoc) : null
}

export async function fetchProductImagesByIds(ids: string[]) {
  if (ids.length === 0) return [] as Array<{ id: string; images: string[] }>
  const records = await Promise.all(ids.map(async id => {
    const res = await db().collection('products').doc(id).field({ images: 1 }).get()
    const data = Array.isArray(res.data) ? res.data[0] : res.data
    return { id, images: Array.isArray((data as any)?.images) ? (data as any).images as string[] : [] }
  }))
  return records
}

export async function createProduct(product: Product & { id: string }) {
  const now = new Date().toISOString()
  const doc = { ...product, createdAt: product.createdAt || now, updatedAt: now }
  await db().collection('products').doc(product.id).set(doc)
  return doc
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Partial<Product> & { updatedAt: string }> {
  const update = { ...updates, updatedAt: new Date().toISOString() }
  await db().collection('products').doc(id).update(update)
  return update as any
}

export async function createProductCategory(category: ProductCategory) {
  await db().collection('categories').doc(category.id).set(category)
  return category
}

export async function updateProductCategory(id: string, updates: Partial<ProductCategory>) {
  await db().collection('categories').doc(id).update(updates)
  return { id, ...updates } as ProductCategory
}

export async function deleteProductCategory(id: string) {
  await db().collection('categories').doc(id).remove()
}

// ===== Orders =====

export async function fetchOrders(id?: string): Promise<any[]> {
  if (id) {
    const docs = await readCollection('orders', { _id: id })
    return docs as any
  }
  return readCollection('orders') as any
}

export async function fetchClerks(): Promise<any[]> {
  const docs = await readCollection('users', { role: 'clerk' })
  return docs as any
}

// ===== Returns =====

export async function fetchReturns(): Promise<any[]> {
  return readCollection('returns') as any
}

// ===== Finance =====

export async function fetchFinanceData() {
  const [withdrawals, invoices] = await Promise.all([
    readCollection('withdrawals') as Promise<any[]>,
    readCollection('invoices') as Promise<any[]>,
  ])
  return { withdrawals, invoices }
}

// ===== Users =====

export async function fetchUsers() {
  const users: any[] = await readCollection('users')
  return {
    customers: users.filter((u: any) => u.role === 'customer'),
    salespersons: users.filter((u: any) => u.role === 'salesperson'),
    agentApplications: users.filter((u: any) => u.agentStatus === 'pending_review'),
    clerks: users.filter((u: any) => u.role === 'clerk'),
  }
}

// ===== Accounts =====

export async function fetchAdminAccounts(): Promise<AdminUser[]> {
  const users = await readCollection('users')
  return users
    .filter(u => ADMIN_ROLES.includes(u.role as AdminRole))
    .map(normalizeAdminUser)
}

export async function createAdminAccount(input: { username: string; password: string; realName: string; phone: string; role: AdminRole }) {
  const { username, password, realName, phone, role } = input
  if (!password || password.length < 6) throw new Error('密码长度至少 6 位')
  const now = new Date().toISOString()
  const id = `admin_${Date.now().toString(36)}`
  const doc = {
    _id: id,
    username,
    password: '***',
    realName: realName || username,
    nickname: realName || username,
    phone,
    avatar: '',
    role,
    permissions: defaultPermissions[role],
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  await db().collection('users').add(doc)
  return normalizeAdminUser(doc)
}

export async function updateAdminAccount(id: string, updates: Partial<AdminUser>) {
  const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (updates.realName !== undefined) { updateData.realName = updates.realName; updateData.nickname = updates.realName }
  if (updates.phone !== undefined) updateData.phone = updates.phone
  if (updates.status !== undefined) updateData.status = updates.status === 'disabled' ? 'disabled' : 'active'
  if (updates.password) {
    if (updates.password.length < 6) throw new Error('密码长度至少 6 位')
    updateData.password = '***'
  }
  if (ADMIN_ROLES.includes(updates.role as AdminRole) && updates.role) {
    updateData.role = updates.role
    updateData.permissions = defaultPermissions[updates.role]
  }
  await db().collection('users').doc(id).update(updateData)
  return updateData
}

export async function deleteAdminAccount(id: string) {
  await db().collection('users').doc(id).remove()
}

// ===== Roles =====

export async function fetchRoles() {
  const users = await readCollection('users')
  const admins = users.filter(u => ADMIN_ROLES.includes(u.role as AdminRole))
  const permissions: Record<AdminRole, Record<string, boolean>> = {} as any
  const counts: Record<AdminRole, number> = { service: 0, product_manager: 0, system_admin: 0 }
  for (const admin of admins) {
    const role = admin.role as AdminRole
    if (ADMIN_ROLES.includes(role)) {
      counts[role] = (counts[role] || 0) + 1
      if (!permissions[role]) permissions[role] = (admin.permissions as Record<string, boolean>) || defaultPermissions[role]
    }
  }
  return { permissions, counts }
}

export async function updateRolePermissions(role: AdminRole, perms: Record<string, boolean>) {
  const _ = db().command
  await db().collection('users').where({ role }).update({ permissions: perms, updatedAt: new Date().toISOString() })
}

// ===== System =====

export async function fetchSystemConfig(): Promise<SystemConfig> {
  const docs = await readCollection('config', { _id: 'system' })
  return (docs[0] as any) || defaultSystemConfig
}

export async function saveSystemConfig(config: SystemConfig) {
  const existing = await readCollection('config', { _id: 'system' })
  if (existing.length > 0) {
    await db().collection('config').doc('system').update({ ...config, updatedAt: new Date().toISOString() })
  } else {
    await db().collection('config').add({ _id: 'system', ...config, updatedAt: new Date().toISOString() })
  }
  return config
}

// ===== Logs =====

export async function fetchLogs(): Promise<any[]> {
  return readCollection('logs') as any
}

// ===== Coupons =====

export async function fetchCouponTemplates(): Promise<CouponTemplate[]> {
  const docs = await readCollection('coupon_templates')
  return docs as unknown as CouponTemplate[]
}

export async function fetchUserCoupons(status?: string, templateId?: string): Promise<UserCoupon[]> {
  const query: Record<string, unknown> = {}
  if (status) query.status = status
  if (templateId) query.templateId = templateId
  const docs = await readCollection('user_coupons', Object.keys(query).length ? query : undefined)
  return docs as unknown as UserCoupon[]
}

export async function fetchTestReports(query?: Record<string, unknown>): Promise<any[]> {
  const docs = await readCollection('test_reports', query)
  return docs as any[]
}

export async function fetchCommissionRecords(query?: Record<string, unknown>): Promise<any[]> {
  const docs = await readCollection('commission_records', query)
  return docs as any[]
}
