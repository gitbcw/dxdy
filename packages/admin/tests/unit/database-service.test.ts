import { beforeEach, describe, expect, it, vi } from 'vitest'

type CollectionData = Record<string, any[]>

let collections: CollectionData = {}
const callLog: Array<{ collection: string; method: string; payload?: any }> = []

function record(collection: string, method: string, payload?: any) {
  callLog.push({ collection, method, payload })
}

function createQueryMock(collectionName: string) {
  let filter: Record<string, unknown> | null = null
  let projection: Record<string, unknown> | null = null
  let limitCount = 500

  const chain: any = {
    where(nextFilter: Record<string, unknown>) {
      filter = nextFilter
      record(collectionName, 'where', nextFilter)
      return chain
    },
    field(nextProjection: Record<string, unknown>) {
      projection = nextProjection
      record(collectionName, 'field', nextProjection)
      return chain
    },
    orderBy() { return chain },
    limit(count: number) {
      limitCount = count
      record(collectionName, 'limit', count)
      return chain
    },
    async get() {
      let data = [...(collections[collectionName] || [])].filter(doc => doc && typeof doc === 'object')
      if (filter) {
        data = data.filter(doc => Object.entries(filter!).every(([key, value]) => doc[key] === value))
      }
      if (projection) {
        data = data.map(doc => Object.fromEntries(Object.entries(doc).filter(([key]) => projection![key] || key === '_id')))
      }
      return { data: data.slice(0, limitCount) }
    },
    async count() {
      let data = [...(collections[collectionName] || [])].filter(doc => doc && typeof doc === 'object')
      if (filter) {
        data = data.filter(doc => Object.entries(filter!).every(([key, value]) => doc[key] === value))
      }
      return { total: data.length }
    },
    async update(payload: any) {
      record(collectionName, 'query.update', payload)
      return payload
    },
  }
  return chain
}

function createDocRef(collectionName: string, id: string) {
  const ref: any = {
    async get() {
      record(collectionName, 'doc.get', id)
      return { data: collections[collectionName]?.find(doc => doc._id === id || doc.id === id) || null }
    },
    async update(payload: any) {
      record(collectionName, 'doc.update', { id, payload })
      return payload
    },
    async set(payload: any) {
      record(collectionName, 'doc.set', { id, payload })
      return payload
    },
    async remove() {
      record(collectionName, 'doc.remove', id)
    },
    field(nextProjection: Record<string, unknown>) {
      record(collectionName, 'doc.field', { id, projection: nextProjection })
      return ref
    },
  }
  return ref
}

function createDbMock() {
  return {
    collection(name: string) {
      return {
        ...createQueryMock(name),
        doc(id: string) {
          return createDocRef(name, id)
        },
        async add(data: any) {
          record(name, 'add', data)
          return { data: { id: `${name}_new` } }
        },
      }
    },
  }
}

vi.mock('../../src/lib/cloudbase', () => ({
  getStoredAdminToken: () => 'token',
  getDb: () => createDbMock(),
  callFunction: vi.fn(async (name: string, payload: any) => {
    if (name === 'queryOrders') {
      if (payload.action === 'getOrderById') {
        const order = collections.orders?.find(doc => doc._id === payload.orderId || doc.id === payload.orderId)
        return { success: true, order: order || null }
      }
      if (payload.action === 'listOrders') {
        return { success: true, orders: collections.orders || [] }
      }
      if (payload.action === 'listClerks') {
        const clerks = (collections.users || []).filter(u => u && u.role === 'clerk')
        return { success: true, clerks }
      }
      return { success: false, error: `unknown queryOrders action: ${payload.action}` }
    }
    return { success: false, error: 'unexpected function' }
  }),
}))

describe('database service', () => {
  beforeEach(() => {
    vi.resetModules()
    callLog.length = 0
    collections = {
      products: [
        { _id: 'p1', name: 'A', status: 'on_sale', createdAt: '2026-05-21', updatedAt: '2026-05-21' },
        { _id: 'p2', name: 'B', isDeleted: true, status: 'off_sale', createdAt: '2026-05-20', updatedAt: '2026-05-20' },
      ],
      categories: [{ _id: 'c1', name: 'Cat', createdAt: '2026-05-21', updatedAt: '2026-05-21' }],
      users: [
        { _id: 'a1', username: 'service', role: 'service', status: 'active', createdAt: '2026-05-21', updatedAt: '2026-05-21' },
        { _id: 'pm1', username: 'pm', role: 'product_manager', status: 'disabled', createdAt: '2026-05-20', updatedAt: '2026-05-20' },
        { _id: 'c1', username: 'customer', role: 'customer', createdAt: '2026-05-20', updatedAt: '2026-05-20', agentStatus: 'pending_review' },
        { _id: 'cl1', username: 'clerk', role: 'clerk', createdAt: '2026-05-20', updatedAt: '2026-05-20' },
      ],
      orders: [
        { _id: 'o1', createdAt: '2026-05-21', status: 'pending_payment' },
        { _id: 'o2', createdAt: '2026-05-20', status: 'completed' },
      ],
      config: [{ _id: 'system', createdAt: '2026-05-21', updatedAt: '2026-05-21', commissionRate: 0.3 }],
      withdrawals: [{ _id: 'w1', createdAt: '2026-05-21' }],
      invoices: [{ _id: 'i1', createdAt: '2026-05-21' }],
      logs: [{ _id: 'l1', createdAt: '2026-05-21' }],
      coupon_templates: [
        null,
        { _id: 'ct1', createdAt: '2026-05-21', scope: 'products', scopeIds: ['p1'], type: 'fixed', value: 10, minAmount: 0, distributeMethod: 'admin', totalQuota: 0, claimedCount: 0, perUserLimit: 1, validDaysAfterClaim: 30, validFrom: '', validTo: '', status: 'active', updatedAt: '2026-05-21' },
        { _id: 'ct2', createdAt: '2026-05-22', scope: null, scopeIds: null, type: 'unknown', value: 'abc', minAmount: null, distributeMethod: 'nope', totalQuota: null, claimedCount: null, perUserLimit: null, validDaysAfterClaim: null, validFrom: null, validTo: null, status: 'broken', updatedAt: '2026-05-22' },
      ],
      user_coupons: [
        null,
        { _id: 'uc1', templateId: 'ct1', status: 'available', scope: 'products', scopeIds: ['p1'], couponName: 'A', couponType: 'fixed', couponValue: 10, minAmount: 0, validFrom: '2026-05-21', validTo: '2026-05-22', source: 'admin_grant', grantedBy: '', createdAt: '2026-05-21', updatedAt: '2026-05-21' },
      ],
    }
  })

  it('filters deleted products and exposes dashboard data', async () => {
    const { fetchDashboardData, fetchProductsAndCategories } = await import('../../src/lib/services/database')
    const dashboard = await fetchDashboardData()
    const catalog = await fetchProductsAndCategories()

    expect(dashboard.products.map((product: any) => product.id)).toEqual(['p1'])
    expect(dashboard.customers).toHaveLength(1)
    expect(dashboard.config).toMatchObject({ commissionRate: 0.3 })
    expect(catalog.categories.map((category: any) => category.id)).toEqual(['c1'])
    expect(catalog.products.map((product: any) => product.id)).toEqual(['p1'])
  })

  it('reads individual records and image projections', async () => {
    const { fetchProductById, fetchProductImagesByIds } = await import('../../src/lib/services/database')
    const product = await fetchProductById('p1')
    const images = await fetchProductImagesByIds(['p1', 'missing'])

    expect(product).toMatchObject({ id: 'p1', name: 'A' })
    expect(images).toEqual([
      { id: 'p1', images: [] },
      { id: 'missing', images: [] },
    ])
  })

  it('creates and updates product and category docs', async () => {
    const { createProduct, updateProduct, createProductCategory, updateProductCategory, deleteProductCategory } = await import('../../src/lib/services/database')

    const created = await createProduct({ id: 'p3', name: 'C' } as any)
    const updated = await updateProduct('p1', { name: 'A+' } as any)
    const category = await createProductCategory({ id: 'c2', name: 'Cat2' } as any)
    const updatedCategory = await updateProductCategory('c1', { name: 'Cat+' } as any)
    await deleteProductCategory('c1')

    expect(created).toMatchObject({ name: 'C' })
    expect(updated).toMatchObject({ name: 'A+' })
    expect(category).toMatchObject({ id: 'c2' })
    expect(updatedCategory).toMatchObject({ id: 'c1', name: 'Cat+' })
    expect(callLog.some(entry => entry.method === 'doc.remove' && entry.collection === 'categories')).toBe(true)
  })

  it('normalizes admin accounts and mutates permissions', async () => {
    const { fetchAdminAccounts, createAdminAccount, updateAdminAccount, fetchRoles, updateRolePermissions, deleteAdminAccount } = await import('../../src/lib/services/database')

    const accounts = await fetchAdminAccounts()
    expect(accounts).toHaveLength(2)
    expect(accounts[0]).toMatchObject({
      id: 'a1',
      username: 'service',
      role: 'service',
      status: 'active',
    })
    expect(accounts[1]).toMatchObject({
      id: 'pm1',
      role: 'product_manager',
      status: 'disabled',
    })

    const created = await createAdminAccount({
      username: 'new-admin',
      password: 'secret1',
      realName: 'New Admin',
      phone: '13800000000',
      role: 'system_admin',
    })
    expect(created).toMatchObject({
      username: 'new-admin',
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
    })

    await updateAdminAccount('a1', { realName: 'Service A', phone: '13900000000', status: 'disabled', password: 'secret2', role: 'system_admin' } as any)
    const roles = await fetchRoles()
    await updateRolePermissions('service', { view_dashboard: false })
    await deleteAdminAccount('pm1')

    expect(roles.counts).toMatchObject({ service: 1, product_manager: 1, system_admin: 0 })
    expect(roles.permissions.service).toBeTruthy()
    expect(callLog.some(entry => entry.method === 'query.update' && entry.collection === 'users')).toBe(true)
    expect(callLog.some(entry => entry.method === 'doc.remove' && entry.collection === 'users' && entry.payload === 'pm1')).toBe(true)
  })

  it('reads system finance, logs, coupons, and commission data', async () => {
    const { fetchFinanceData, fetchLogs, fetchCouponTemplates, fetchUserCoupons, fetchTestReports, fetchCommissionRecords, fetchUsers, fetchClerks, fetchOrders, fetchReturns, fetchSystemConfig, saveSystemConfig } = await import('../../src/lib/services/database')

    expect(await fetchFinanceData()).toMatchObject({
      withdrawals: [{ id: 'w1' }],
      invoices: [{ id: 'i1' }],
    })
    expect(await fetchLogs()).toHaveLength(1)
    expect(await fetchCouponTemplates()).toMatchObject([
      { id: 'ct2', scope: null, scopeIds: null },
      { id: 'ct1', scope: 'products', scopeIds: ['p1'] },
    ])
    expect(await fetchUserCoupons('available', 'ct1')).toMatchObject([
      { id: 'uc1', scope: 'products', scopeIds: ['p1'], source: 'admin_grant' },
    ])
    expect(await fetchTestReports()).toEqual([])
    expect(await fetchCommissionRecords()).toEqual([])
    expect((await fetchUsers()).clerks).toHaveLength(1)
    expect(await fetchClerks()).toHaveLength(1)
    expect(await fetchOrders('o1')).toHaveLength(1)
    expect(await fetchReturns()).toEqual([])
    expect(await fetchSystemConfig()).toMatchObject({ commissionRate: 0.3 })

    await saveSystemConfig({ id: 'system', commissionRate: 0.25 } as any)
    expect(callLog.some(entry => entry.method === 'doc.update' && entry.collection === 'config' && entry.payload?.id === 'system')).toBe(true)
  })

  it('falls back to add when system config is missing and fetches orders by id', async () => {
    collections.config = []
    const { fetchOrders, saveSystemConfig } = await import('../../src/lib/services/database')

    expect(await fetchOrders('o1')).toHaveLength(1)
    await saveSystemConfig({ id: 'system', commissionRate: 0.2 } as any)

    expect(callLog.some(entry => entry.method === 'add' && entry.collection === 'config')).toBe(true)
  })
})
