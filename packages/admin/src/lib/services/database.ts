import { callFunction, getStoredAdminToken } from '@/lib/cloudbase'
import type {
  AdminRole, AdminUser, Product, ProductCategory, Order,
  ReturnRecord, OperationLog, SystemConfig, User, Customer, Salesperson, Clerk,
  CouponTemplate, UserCoupon, OfficialArticle,
} from '@/lib/types'
import { defaultSystemConfig } from '@/lib/format'
import { queryOrders } from '@/lib/services/functions'

type CloudDoc = Record<string, unknown>
const ADMIN_SESSION_KEY = 'dxdy_admin_profile'

const ADMIN_ROLES: AdminRole[] = ['service', 'product_manager', 'system_admin', 'clerk']
const ROLE_PERMISSIONS_CONFIG_ID = 'role_permissions'

const defaultPermissions: Record<AdminRole, Record<string, boolean>> = {
  service: { view_dashboard: true, manage_orders: true, order_price_adjust: false, manage_returns: true },
  product_manager: { view_dashboard: true, manage_products: true },
  clerk: { manage_orders: true, manage_returns: true },
  system_admin: {
    view_dashboard: true, manage_products: true, manage_orders: true, order_price_adjust: false,
    manage_returns: true, manage_users: true, manage_accounts: true,
    manage_roles: true, manage_system: true, view_logs: true,
  },
}

// ===== Helpers =====

type AdminDataResult<T = unknown> = { success?: boolean; error?: string; data?: T }

async function adminRequest<T = unknown>(action: string, collection: string, extra: Record<string, unknown> = {}): Promise<T> {
  const result = await callFunction<AdminDataResult<T>>('adminData', {
    token: getStoredAdminToken(),
    action,
    collection,
    ...extra,
  })
  if (!result.success) throw new Error(result.error || '数据请求失败')
  return result.data as T
}

function normalizeDoc<T extends CloudDoc>(doc: T): T & { id: string } {
  const { _id, id, ...rest } = doc as Record<string, unknown>
  return { ...rest, id: String(_id || id || '') } as T & { id: string }
}

function normalizeDocs<T extends CloudDoc>(docs: unknown[]): (T & { id: string })[] {
  if (!Array.isArray(docs)) return []
  return docs
    .filter((d): d is T => d != null && typeof d === 'object')
    .map(normalizeDoc)
}

function sortByRecent<T extends CloudDoc>(a: T, b: T) {
  return String(b.createdAt || b.updatedAt || '').localeCompare(String(a.createdAt || a.updatedAt || ''))
}

function resolveAdminOperatorId(operatorId?: string) {
  if (operatorId) return operatorId
  if (typeof window === 'undefined') return ''
  try {
    const stored = window.localStorage.getItem(ADMIN_SESSION_KEY)
    if (!stored) return ''
    const profile = JSON.parse(stored) as { id?: unknown }
    return typeof profile.id === 'string' ? profile.id : ''
  } catch {
    return ''
  }
}

function mergeRolePermissions(source?: Partial<Record<AdminRole, Record<string, boolean>>>) {
  const result = {} as Record<AdminRole, Record<string, boolean>>
  for (const role of ADMIN_ROLES) {
    result[role] = { ...defaultPermissions[role], ...(source?.[role] || {}) }
  }
  return result
}

async function fetchRolePermissionTemplates() {
  try {
    const data = await adminRequest<Record<string, unknown>>('get', 'config', { id: ROLE_PERMISSIONS_CONFIG_ID })
    const saved = (data as Record<string, unknown>)?.permissions as Partial<Record<AdminRole, Record<string, boolean>>> | undefined
    return mergeRolePermissions(saved)
  } catch {
    return mergeRolePermissions()
  }
}

async function readCollection<T extends CloudDoc>(name: string, query?: Record<string, unknown>, projection?: Record<string, unknown>): Promise<(T & { id: string })[]> {
  const extra: Record<string, unknown> = {}
  if (query && Object.keys(query).length > 0) extra.query = query
  if (projection && Object.keys(projection).length > 0) extra.field = projection
  const docs = await adminRequest<unknown[]>('list', name, extra)
  return normalizeDocs<T>(docs).sort(sortByRecent)
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
    readCollection('config'),
  ]) as any
  return {
    orders,
    returns,
    products: products.filter((product: any) => !product.isDeleted && !product.deletedAt),
    customers: users.filter((u: any) => u.role === 'customer' && u.customerType === 'institution'),
    config: configRecords[0] || defaultSystemConfig,
  }
}

// ===== Products =====

export async function fetchProductsAndCategories() {
  const productProjection = {
    _id: 1, id: 1, name: 1, category: 1, institutionPrice: 1, personalPrice: 1,
    visibility: 1, stock: 1, salesCount: 1, serviceTags: 1, status: 1, productType: 1, isBloodPack: 1, bookingConfig: 1,
    purchaseLimit: 1, agreementRequired: 1, salesCountEnabled: 1, urgentConfig: 1,
    redeemableCategory: 1, validDays: 1, promotionPrice: 1, promotionStart: 1, promotionEnd: 1,
    visibleRegions: 1, hiddenRegions: 1,
    isDeleted: 1, deletedAt: 1, createdAt: 1, updatedAt: 1,
  }
  const [products, categories] = await Promise.all([
    readCollection('products', undefined, productProjection),
    readCollection('categories'),
  ]) as any
  return {
    products: products.filter((product: any) => !product.isDeleted && !product.deletedAt),
    categories,
  }
}

export async function fetchProductById(id: string) {
  const data = await adminRequest<Record<string, unknown>>('get', 'products', { id })
  return data ? normalizeDoc(data as CloudDoc) : null
}

export async function fetchProductImagesByIds(ids: string[]) {
  if (ids.length === 0) return [] as Array<{ id: string; images: string[] }>
  const results = await Promise.all(ids.map(async id => {
    const data = await adminRequest<Record<string, unknown>>('get', 'products', { id, field: { images: 1 } })
    return { id, images: Array.isArray((data as any)?.images) ? (data as any).images as string[] : [] }
  }))
  return results
}

export async function createProduct(product: Product & { id: string }) {
  const now = new Date().toISOString()
  const doc = { ...product, createdAt: product.createdAt || now, updatedAt: now }
  await adminRequest('set', 'products', { id: product.id, data: doc })
  return doc
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Partial<Product> & { id: string; updatedAt: string }> {
  const update = { ...updates, updatedAt: new Date().toISOString() }
  await adminRequest('update', 'products', { id, data: update })
  return { id, ...update }
}

export async function createProductCategory(category: ProductCategory) {
  await adminRequest('set', 'categories', { id: category.id, data: category })
  return category
}

export async function updateProductCategory(id: string, updates: Partial<ProductCategory>) {
  await adminRequest('update', 'categories', { id, data: updates })
  return { id, ...updates } as ProductCategory
}

export async function deleteProductCategory(id: string) {
  await adminRequest('remove', 'categories', { id })
}

// ===== Articles =====

function normalizeOfficialArticle(doc: CloudDoc & { id: string }): OfficialArticle {
  return {
    id: String(doc.id || ''),
    title: String(doc.title || ''),
    subtitle: String(doc.subtitle || ''),
    coverUrl: String(doc.coverUrl || ''),
    articleUrl: String(doc.articleUrl || ''),
    tag: String(doc.tag || ''),
    status: doc.status === 'inactive' ? 'inactive' : 'active',
    sort: Number(doc.sort || 0),
    publishedAt: String(doc.publishedAt || ''),
    createdAt: String(doc.createdAt || ''),
    updatedAt: String(doc.updatedAt || ''),
  }
}

export async function fetchOfficialArticles() {
  const docs = (await readCollection('articles')).map(normalizeOfficialArticle)
  return docs.sort((a, b) => {
    const sortDiff = (Number(a.sort) || 0) - (Number(b.sort) || 0)
    if (sortDiff !== 0) return sortDiff
    return String(b.publishedAt || b.createdAt || '').localeCompare(String(a.publishedAt || a.createdAt || ''))
  })
}

export async function createOfficialArticle(article: OfficialArticle & { id: string }) {
  const now = new Date().toISOString()
  const doc = { ...article, createdAt: article.createdAt || now, updatedAt: now }
  await adminRequest('set', 'articles', { id: article.id, data: doc })
  return doc
}

export async function updateOfficialArticle(id: string, updates: Partial<OfficialArticle>) {
  const update = { ...updates, updatedAt: new Date().toISOString() }
  await adminRequest('update', 'articles', { id, data: update })
  return update as Partial<OfficialArticle> & { updatedAt: string }
}

export async function deleteOfficialArticle(id: string) {
  await adminRequest('remove', 'articles', { id })
}

// ===== Orders =====

export async function fetchOrders(id?: string, operatorId?: string): Promise<any[]> {
  const resolvedOperatorId = resolveAdminOperatorId(operatorId)
  if (id) {
    const result = await queryOrders({ action: 'getOrderById', orderId: id, operatorId: resolvedOperatorId })
    if (!result.success) throw new Error(result.error || '读取订单详情失败')
    return result.order ? [result.order] as any[] : []
  }
  const result = await queryOrders({ action: 'listOrders', operatorId: resolvedOperatorId })
  if (!result.success) throw new Error(result.error || '读取订单数据失败')
  return (result.orders || []) as any[]
}

export async function fetchClerks(operatorId?: string): Promise<any[]> {
  const resolvedOperatorId = resolveAdminOperatorId(operatorId)
  const result = await queryOrders({ action: 'listClerks', operatorId: resolvedOperatorId })
  if (!result.success) throw new Error(result.error || '读取制单员数据失败')
  return (result.clerks || []) as any[]
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
  const finalUsername = role === 'clerk' ? phone.trim() : username.trim()
  if (!finalUsername) throw new Error('请输入用户名')
  if (!realName.trim()) throw new Error('请输入姓名')
  if (!phone.trim()) throw new Error('请输入手机号')
  if (!password || password.length < 6) throw new Error('密码长度至少 6 位')
  const now = new Date().toISOString()
  const id = `admin_${Date.now().toString(36)}`
  const rolePermissions = await fetchRolePermissionTemplates()
  const doc = {
    _id: id,
    username: finalUsername,
    password,
    realName: realName.trim(),
    nickname: realName.trim(),
    phone: phone.trim(),
    avatar: '',
    role,
    permissions: rolePermissions[role],
    status: 'active',
    ...(role === 'clerk' ? { assignedOrderIds: [] } : {}),
    createdAt: now,
    updatedAt: now,
  }
  await adminRequest('add', 'users', { data: doc })
  return normalizeAdminUser(doc)
}

export async function updateAdminAccount(id: string, updates: Partial<AdminUser>) {
  const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (updates.realName !== undefined) { updateData.realName = updates.realName; updateData.nickname = updates.realName }
  if (updates.phone !== undefined) updateData.phone = updates.phone
  if (updates.status !== undefined) updateData.status = updates.status === 'disabled' ? 'disabled' : 'active'
  if (updates.password) {
    if (updates.password.length < 6) throw new Error('密码长度至少 6 位')
    updateData.password = updates.password
  }
  if (ADMIN_ROLES.includes(updates.role as AdminRole) && updates.role) {
    const rolePermissions = await fetchRolePermissionTemplates()
    updateData.role = updates.role
    updateData.permissions = rolePermissions[updates.role]
  }
  if (updates.role === 'clerk' && typeof updates.phone === 'string') {
    updateData.username = updates.phone.trim()
  }
  await adminRequest('update', 'users', { id, data: updateData })
  return updateData
}

export async function deleteAdminAccount(id: string) {
  await adminRequest('remove', 'users', { id })
}

// ===== Roles =====

export async function fetchRoles() {
  const [users, rolePermissions] = await Promise.all([
    readCollection('users'),
    fetchRolePermissionTemplates(),
  ])
  const admins = users.filter(u => ADMIN_ROLES.includes(u.role as AdminRole))
  const permissions = mergeRolePermissions(rolePermissions)
  const counts: Record<AdminRole, number> = { service: 0, product_manager: 0, system_admin: 0, clerk: 0 }
  for (const admin of admins) {
    const role = admin.role as AdminRole
    if (ADMIN_ROLES.includes(role)) {
      counts[role] = (counts[role] || 0) + 1
    }
  }
  return { permissions, counts }
}

export async function updateRolePermissions(role: AdminRole, perms: Record<string, boolean>) {
  const now = new Date().toISOString()
  const rolePermissions = await fetchRolePermissionTemplates()
  const nextPermissions = {
    ...rolePermissions,
    [role]: { ...defaultPermissions[role], ...perms },
  }
  await adminRequest('set', 'config', { id: ROLE_PERMISSIONS_CONFIG_ID, data: { permissions: nextPermissions, updatedAt: now } })
  await adminRequest('updateWhere', 'users', { query: { role }, data: { permissions: nextPermissions[role], updatedAt: now } })
}

// ===== System =====

export async function fetchSystemConfig(): Promise<SystemConfig> {
  const docs = await readCollection('config')
  const match = docs.find((d: any) => d._id === 'system' || d.id === 'system')
  const saved = (match as any) || {}
  return {
    ...defaultSystemConfig,
    ...saved,
    bloodBookingConfig: {
      ...defaultSystemConfig.bloodBookingConfig,
      ...(saved.bloodBookingConfig || {}),
    },
  }
}

export async function saveSystemConfig(config: SystemConfig) {
  await adminRequest('set', 'config', { id: 'system', data: { ...config, updatedAt: new Date().toISOString() } })
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

// ===== Admin Status =====

export async function fetchAdminStatus(id: string): Promise<{ status: string } | null> {
  try {
    const data = await adminRequest<{ id: string; status: string } | null>('getAdminStatus', '', { id })
    return data
  } catch {
    return null
  }
}

// ===== Card Vouchers =====

export async function fetchCardVouchers(): Promise<any[]> {
  return readCollection('card_vouchers')
}

export async function createCardVoucher(data: Record<string, unknown>) {
  const now = new Date().toISOString()
  const doc = { ...data, createdAt: data.createdAt || now, updatedAt: now }
  const result = await adminRequest<{ id: string }>('add', 'card_vouchers', { data: doc })
  return { ...doc, id: result.id }
}

export async function updateCardVoucher(id: string, updates: Record<string, unknown>) {
  const update = { ...updates, updatedAt: new Date().toISOString() }
  await adminRequest('update', 'card_vouchers', { id, data: update })
  return update
}

// ===== Reviews =====

export async function fetchProductReviews(status?: string): Promise<any[]> {
  const query = status && status !== 'all' ? { status } : undefined
  return readCollection('product_reviews', query)
}

// ===== Logs (write) =====

export async function appendAdminLog(entry: Record<string, unknown>) {
  await adminRequest('add', 'logs', { data: entry })
}
