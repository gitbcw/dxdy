/**
 * 云开发服务层 —— 替代原 shared/src mock 层
 * 所有数据通过 wx.cloud.database() 读写
 */

// ===== 数据库初始化 =====
const db = wx.cloud.database()
const _ = db.command

const CLOUD_STORAGE_PREFIX = 'cloud://cloudbase-d4gwpsm7gcc59b6fc.636c-cloudbase-d4gwpsm7gcc59b6fc-1428922768/dxdy/generated-ui'
const CLOUD_STORAGE_V2_PREFIX = `${CLOUD_STORAGE_PREFIX}/v2`

export const GENERATED_ASSETS = {
  loginHero: `${CLOUD_STORAGE_V2_PREFIX}/login-vet-hero-v2.jpg`,
  homeBanner: `${CLOUD_STORAGE_V2_PREFIX}/home-vet-banner-v2.jpg`,
  bloodBag: `${CLOUD_STORAGE_PREFIX}/product-blood-bag.webp`,
  vaccineKit: `${CLOUD_STORAGE_PREFIX}/product-vaccine-kit.webp`,
  testCard: `${CLOUD_STORAGE_PREFIX}/product-test-card.webp`,
  coldChain: `${CLOUD_STORAGE_V2_PREFIX}/cold-chain-logistics-v2.jpg`,
  testTraceability: `${CLOUD_STORAGE_V2_PREFIX}/test-traceability-v2.jpg`,
  agentPromotion: `${CLOUD_STORAGE_V2_PREFIX}/agent-promotion-v2.jpg`,
}

// ===== Helpers =====

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

/** 将云数据库 _id 映射为 id 字段，保持页面兼容 */
function normalize<T extends Record<string, any>>(doc: any): T {
  if (!doc) return doc
  const { _id, _openid, ...rest } = doc
  return { id: _id, ...rest } as T
}

function normalizeList(docs: any[]): any[] {
  return docs.map(normalize)
}

function mapClerkOrder(order: any) {
  if (!order) return order
  const shipping = order.shipping || {}
  const address = shipping.address || order.shippingAddress || {}
  const pricing = order.pricing || {}
  const coldChain = shipping.coldChain || {}
  const items = (order.items || []).map((item: any) => ({
    ...item,
    name: item.name || item.productName || '',
    specs: item.specs || item.spec || '',
    price: item.price ?? item.unitPrice ?? item.totalPrice ?? 0,
    imageUrl: item.imageUrl || item.productImage || getProductVisualImage(item),
    batchNo: item.batchNo || item.batch || item.productionBatch || '',
    validUntil: item.validUntil || item.expiryDate || item.expireAt || '',
    storageTemperature: item.storageTemperature || item.temperature || shipping.temperature || '',
  }))
  return {
    ...order,
    rawStatus: order.status,
    status: order.status === 'pending_receipt' ? 'shipped' : order.status === 'preparing' ? 'preparing' : 'pending',
    items,
    expressCompany: shipping.company || '',
    expressNo: shipping.trackingNo || '',
    shippedAt: shipping.shippedAt || '',
    packageType: coldChain.packageType || shipping.packageType || '',
    coldChainMethod: coldChain.method || shipping.coldChainMethod || '',
    packageWeight: coldChain.weight || shipping.packageWeight || '',
    boxTemperature: coldChain.boxTemperature || shipping.boxTemperature || '',
    temperature: shipping.temperature || coldChain.temperature || '',
    eta: shipping.eta || '',
    lastModifyReason: shipping.lastModifyReason || '',
    assignedAt: order.assignedAt || order.createdAt || '',
    address: address.full || address.detail || order.address || '',
    customerPhone: address.phone || order.customerPhone || '',
    totalAmount: pricing.actualAmount ?? order.totalAmount ?? 0,
  }
}

function getCurrentOpenid(): string {
  return getApp().globalData.openid || ''
}

function isLocalTempFile(path?: string): boolean {
  if (!path) return false
  return path.startsWith('wxfile://') || path.startsWith('http://tmp/') || path.startsWith('https://tmp/') || path.startsWith('file://')
}

async function uploadLocalFile(localPath: string, cloudPath: string) {
  if (!isLocalTempFile(localPath)) return localPath
  const { fileID } = await wx.cloud.uploadFile({
    cloudPath,
    filePath: localPath,
  })
  return fileID
}

// ===== 工具函数 =====

export function formatMoney(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return `${formatDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

export function getOrderStatusText(status: string): string {
  const map: Record<string, string> = {
    pending_payment: '待付款', pending_shipment: '待发货', preparing: '备货中', pending_receipt: '待收货',
    completed: '已完成', cancelled: '已取消', pending_confirmation: '待确认',
    confirmed: '已确认', in_service: '服务中', pending_review: '待审核',
    approved: '已通过', rejected: '已驳回',
  }
  return map[status] || status
}

export function getOrderStatusDesc(status: string): string {
  const map: Record<string, string> = {
    pending_payment: '订单等待买家付款', pending_shipment: '买家已付款，等待发货',
    preparing: '制单员正在备货中', pending_receipt: '卖家已发货，等待确认收货', completed: '交易完成',
    cancelled: '订单已取消', pending_confirmation: '预约订单等待确认',
    confirmed: '预约已确认，等待服务', in_service: '服务进行中',
  }
  return map[status] || ''
}

export function getProductVisualImage(productOrName: any): string {
  const name = typeof productOrName === 'string'
    ? productOrName
    : String(productOrName?.name || productOrName?.productName || '')
  if (productOrName?.isBloodPack || /血|红细胞|血包/.test(name)) return GENERATED_ASSETS.bloodBag
  if (/检测|试纸|检验|报告/.test(name)) return GENERATED_ASSETS.testCard
  return GENERATED_ASSETS.vaccineKit
}

// ===== 认证服务 =====

export async function loginByPhone(phone: string) {
  try {
    const { data } = await db.collection('users').where({ phone }).get()
    if (data.length > 0) {
      const user = normalize(data[0])
      wx.setStorageSync('current_user', JSON.stringify(user))
      return { success: true, user }
    }
    return { success: false, error: '用户不存在' }
  } catch (err) {
    return { success: false, error: '登录失败' }
  }
}

export async function adminLogin(username: string, _password: string) {
  try {
    const { data } = await db.collection('users').where({
      username, role: 'admin', status: 'active',
    }).get()
    if (data.length > 0) {
      const user = normalize(data[0])
      wx.setStorageSync('current_user', JSON.stringify(user))
      return { success: true, user }
    }
    return { success: false, error: '用户名或密码错误' }
  } catch (err) {
    return { success: false, error: '登录失败' }
  }
}

export function getCurrentUser() {
  const str = wx.getStorageSync('current_user') as string
  if (str) {
    try { return JSON.parse(str) } catch { return null }
  }
  return null
}

export function logout() {
  wx.removeStorageSync('current_user')
}

export async function registerCustomer(phone: string, nickname: string, customerType: string = 'personal') {
  try {
    const { data: existing } = await db.collection('users').where({ phone }).get()
    if (existing.length > 0) {
      return { success: false, error: '该手机号已注册' }
    }
    const user = {
      phone, nickname, avatar: '', role: 'customer', customerType,
      verificationStatus: 'none', boundSalespersonId: null,
      wallet: { balance: 0, rechargeHistory: [] },
      points: { balance: 200, history: [{ id: generateId('pts'), change: 200, balance: 200, reason: '注册赠送', createdAt: formatDate(new Date()) }] },
      addresses: [] as any[], createdAt: formatDate(new Date()),
    }
    const { _id } = await db.collection('users').add({ data: user })
    const result = { ...user, id: _id }
    wx.setStorageSync('current_user', JSON.stringify(result))
    return { success: true, user: result }
  } catch (err) {
    return { success: false, error: '注册失败' }
  }
}

// ===== 商品服务 =====

export async function getProducts(options?: { visibility?: string; categoryId?: string; keyword?: string }) {
  const cond: any = { status: 'on_sale' }
  if (options?.categoryId) cond.category = options.categoryId
  if (options?.visibility && options.visibility !== 'all') {
    const visibilityMap: Record<string, string[]> = {
      personal: ['personal_only', 'all'],
      institution: ['institution_only', 'all'],
      personal_only: ['personal_only', 'all'],
      institution_only: ['institution_only', 'all'],
    }
    cond.visibility = _.in(visibilityMap[options.visibility] || [options.visibility, 'all'])
  }
  if (options?.keyword) {
    cond.name = db.RegExp({ regexp: options.keyword, options: 'i' })
  }
  const { data } = await db.collection('products').where(cond).limit(100).get()
  return normalizeList(data)
}

export async function getProductById(id: string) {
  try {
    const { data } = await db.collection('products').doc(id).get()
    return normalize(data)
  } catch { return null }
}

export async function getCategories() {
  const { data } = await db.collection('categories').orderBy('sort', 'asc').limit(100).get()
  return normalizeList(data)
}

// ===== 订单服务 =====

export async function getOrders(options?: { customerId?: string; salespersonId?: string; clerkId?: string; status?: string }) {
  const cond: any = {}
  if (options?.customerId) cond.customerId = options.customerId
  if (options?.salespersonId) cond.salespersonId = options.salespersonId
  if (options?.clerkId) cond.clerkId = options.clerkId
  if (options?.status) cond.status = options.status
  const { data } = await db.collection('orders').where(cond).orderBy('createdAt', 'desc').limit(100).get()
  return normalizeList(data)
}

export async function getOrderById(id: string) {
  try {
    const { data } = await db.collection('orders').doc(id).get()
    return normalize(data)
  } catch { return null }
}

export async function getOrderByNo(orderNo: string) {
  try {
    const { data } = await db.collection('orders').where({ orderNo }).limit(1).get()
    return data[0] ? normalize(data[0]) : null
  } catch { return null }
}

export async function createOrder(params: {
  customerId: string; items: any[]; type: string
  booking?: any; shippingAddress?: any; remark?: string; couponId?: string
}) {
  const { result } = await wx.cloud.callFunction({
    name: 'createOrder',
    data: params,
  }) as any
  if (!result?.success) {
    throw new Error(result?.error || '订单创建失败')
  }
  return result.order
}

export async function payOrder(orderId: string, method: string = 'wechat') {
  const { result } = await wx.cloud.callFunction({
    name: 'payOrder',
    data: { orderId, method },
  }) as any
  return result || { success: false, error: '支付失败' }
}

export async function adjustOrderPrice(orderId: string, newPrice: number, operatorId: string, operatorName: string, _permissions?: any) {
  const { result } = await wx.cloud.callFunction({
    name: 'adjustOrderPrice',
    data: { orderId, newPrice, operatorId, operatorName },
  }) as any
  return result || { success: false, error: '改价失败' }
}

export async function updateOrderStatus(orderId: string, status: string) {
  const user = getCurrentUser()
  const { result } = await wx.cloud.callFunction({
    name: 'updateOrderStatus',
    data: {
      orderId,
      status,
      operatorId: user?.id,
      operatorName: user?.nickname || user?.realName || user?.username || user?.phone,
    },
  }) as any
  if (!result?.success) {
    throw new Error(result?.error || '订单状态更新失败')
  }
  return result.order
}

export async function updateOrderStatusWithLog(orderId: string, status: string, operator?: { id: string; name: string; role: string }) {
  const user = getCurrentUser()
  const { result } = await wx.cloud.callFunction({
    name: 'updateOrderStatus',
    data: {
      orderId,
      status,
      operatorId: operator?.id || user?.id,
      operatorName: operator?.name || user?.nickname || user?.realName || user?.username || user?.phone,
    },
  }) as any
  if (!result?.success) {
    throw new Error(result?.error || '订单状态更新失败')
  }
  return result.order
}

export async function cancelOrder(orderId: string) {
  return updateOrderStatus(orderId, 'cancelled')
}

export async function shipOrder(orderId: string, trackingNo: string, company: string) {
  const order = await getOrderById(orderId)
  const newStatus = order?.type === 'booking' ? 'in_service' : 'pending_receipt'
  const shippedAt = formatDateTime(new Date())
  await db.collection('orders').doc(orderId).update({
    data: {
      'shipping.trackingNo': trackingNo,
      'shipping.company': company,
      'shipping.shippedAt': shippedAt,
      'shipping.eta': order?.type === 'booking' ? '按预约时间送达' : '',
      'shipping.temperature': order?.items?.some((item: any) => item.productName?.includes('血'))
        ? '2-8°C 冷链'
        : '',
      'shipping.logistics': _.push({
        time: shippedAt,
        title: '商家已发货',
        description: '包裹已完成出库交接',
        location: '仓库',
      }),
      status: newStatus,
      updatedAt: shippedAt,
    },
  })
  return getOrderById(orderId)
}

export async function confirmBooking(orderId: string) {
  return updateOrderStatus(orderId, 'confirmed')
}

// ===== 制单员订单服务 =====

export async function getClerkOrders(options?: { status?: string }) {
  const cond: any = { clerkId: _.neq(null).and(_.neq('')) }
  if (options?.status === 'pending') {
    cond.status = _.in(['pending_shipment', 'confirmed', 'preparing'])
  } else if (options?.status === 'shipped') {
    cond.status = 'pending_receipt'
  }
  const { data } = await db.collection('orders').where(cond).orderBy('createdAt', 'desc').limit(100).get()
  return normalizeList(data).map(mapClerkOrder)
}

export async function getClerkOrderById(id: string) {
  const order = await getOrderById(id)
  return mapClerkOrder(order)
}

export async function clerkShipOrder(params: {
  orderId: string
  expressCompany: string
  expressNo: string
  packageType?: string
  coldChainMethod?: string
  packageWeight?: string
  boxTemperature?: string
  modifyReason?: string
}) {
  const user = getCurrentUser()
  const { result } = await wx.cloud.callFunction({
    name: 'clerkShipOrder',
    data: { ...params, operatorId: user?.id },
  }) as any
  if (!result?.success) {
    throw new Error(result?.error || '物流提交失败')
  }
  return result
}

export async function markOrderPreparing(orderId: string) {
  const now = formatDateTime(new Date())
  await db.collection('orders').doc(orderId).update({
    data: { status: 'preparing', updatedAt: now },
  })
  return getOrderById(orderId)
}

// ===== 退换货服务 =====

export async function getReturns(options?: { orderId?: string; status?: string }) {
  const cond: any = {}
  if (options?.orderId) cond.orderId = options.orderId
  if (options?.status) cond.status = options.status
  const { data } = await db.collection('returns').where(cond).orderBy('createdAt', 'desc').limit(100).get()
  return normalizeList(data)
}

export async function getReturnById(id: string) {
  try {
    const { data } = await db.collection('returns').doc(id).get()
    return normalize(data)
  } catch { return null }
}

export async function createReturn(params: {
  orderId: string; type: string; reason: string
  items: any[]; exchangeItem?: any; description?: string
  vouchers?: string[]; refundAmount?: number; customerId?: string
}) {
  const voucherFileIDs = await Promise.all((params.vouchers || []).map((path, index) => (
    uploadLocalFile(path, `returns/${params.orderId}/${Date.now()}-${index}.jpg`)
  )))
  const { result } = await wx.cloud.callFunction({
    name: 'createReturn',
    data: {
      ...params,
      vouchers: voucherFileIDs,
    },
  }) as any
  if (!result?.success) {
    throw new Error(result?.error || '售后申请提交失败')
  }
  return result.record
}

export async function reviewReturn(id: string, approved: boolean, reviewerId: string, note: string) {
  const { result } = await wx.cloud.callFunction({
    name: 'reviewReturn',
    data: { id, approved, reviewerId, note },
  }) as any
  if (!result?.success) {
    throw new Error(result?.error || '售后审核失败')
  }
  return result.record
}

export async function updateReturnStatus(id: string, status: string, operator?: { id: string; name?: string }) {
  const user = getCurrentUser()
  const { result } = await wx.cloud.callFunction({
    name: 'reviewReturn',
    data: {
      id,
      status,
      operatorId: operator?.id || user?.id,
      operatorName: operator?.name || user?.nickname || user?.realName || user?.username || user?.phone,
    },
  }) as any
  if (!result?.success) {
    throw new Error(result?.error || '售后状态更新失败')
  }
  return result.record
}

export async function updateReturnLogistics(returnId: string, logistics: { company: string; trackingNo: string }) {
  const user = getCurrentUser()
  const { result } = await wx.cloud.callFunction({
    name: 'reviewReturn',
    data: {
      id: returnId,
      status: 'customer_shipping',
      sendLogistics: logistics,
      operatorId: user?.id,
      operatorName: user?.nickname || user?.realName || user?.phone || '',
    },
  }) as any
  if (!result?.success) {
    throw new Error(result?.error || '物流信息提交失败')
  }
  return result.record
}

// ===== 发票服务 =====

export async function getInvoices(options?: { customerId?: string; orderId?: string; status?: string }) {
  const cond: any = {}
  if (options?.customerId) cond.customerId = options.customerId
  if (options?.orderId) cond.orderId = options.orderId
  if (options?.status) cond.status = options.status
  const { data } = await db.collection('invoices').where(cond).orderBy('createdAt', 'desc').limit(100).get()
  return normalizeList(data)
}

export async function getInvoiceByOrderId(orderId: string) {
  const invoices = await getInvoices({ orderId })
  return invoices[0] || null
}

export async function createInvoice(params: {
  customerId: string
  orderId: string
  invoiceType: string
  title: string
  taxNo: string
  email: string
  remark?: string
}) {
  const { result } = await wx.cloud.callFunction({
    name: 'createInvoice',
    data: params,
  }) as any
  return result || { success: false, error: '提交失败' }
}

export async function processInvoice(params: {
  id: string
  status?: string
  invoiceFileID?: string
  invoiceNo?: string
  note?: string
  trackingNo?: string
  company?: string
  operatorId?: string
  operatorName?: string
}) {
  const user = getCurrentUser()
  const { result } = await wx.cloud.callFunction({
    name: 'processInvoice',
    data: {
      ...params,
      operatorId: params.operatorId || user?.id,
      operatorName: params.operatorName || user?.nickname || user?.realName || user?.username || user?.phone,
    },
  }) as any
  if (!result?.success) {
    throw new Error(result?.error || '发票处理失败')
  }
  return result.invoice
}

// ===== 检测报告服务 =====

export async function getTestReports(options?: { code?: string; batchNo?: string }) {
  const cond: any = {}
  if (options?.code) cond.code = options.code
  if (options?.batchNo) cond.batchNo = options.batchNo
  const { data } = await db.collection('test_reports').where(cond).orderBy('testedAt', 'desc').limit(20).get()
  return normalizeList(data)
}

export async function getTestReportByCode(code: string) {
  const keyword = code.trim()
  if (!keyword) return null
  const byCode = await getTestReports({ code: keyword })
  if (byCode[0]) return byCode[0]
  const byBatch = await getTestReports({ batchNo: keyword })
  return byBatch[0] || null
}

// ===== 佣金与提成服务 =====

export async function getCommissionRecords(salespersonId: string) {
  const { data } = await db.collection('commission_records').where({ salespersonId }).orderBy('createdAt', 'desc').limit(100).get()
  return normalizeList(data)
}

export async function getCommissionSummary() {
  const user = getCurrentUser()
  if (!user) return { total: 0, available: 0, withdrawn: 0, pendingDeduction: 0, pendingLock: 0 }
  try {
    const { data } = await db.collection('users').doc(user.id).get()
    const u = normalize(data)
    return {
      total: u.commission?.total || 0,
      available: u.commission?.available || 0,
      withdrawable: u.commission?.available || 0,
      withdrawn: u.commission?.withdrawn || 0,
      pending: u.commission?.pendingDeduction || 0,
      pendingDeduction: u.commission?.pendingDeduction || 0,
      pendingLock: 0,
    }
  } catch {
    return { total: 0, available: 0, withdrawable: 0, withdrawn: 0, pending: 0, pendingDeduction: 0, pendingLock: 0 }
  }
}

export async function getSalesmanCustomers() {
  const user = getCurrentUser()
  if (!user) return []
  const [{ data: customerDocs }, { data: orderDocs }, { data: returnDocs }] = await Promise.all([
    db.collection('users').where({ role: 'customer', boundSalespersonId: user.id }).limit(100).get(),
    db.collection('orders').where({ salespersonId: user.id }).orderBy('createdAt', 'desc').limit(100).get(),
    db.collection('returns').limit(100).get(),
  ])
  const orders = normalizeList(orderDocs)
  const returns = normalizeList(returnDocs)
  return normalizeList(customerDocs).map((customer: any) => {
    const customerOrders = orders.filter((order: any) => order.customerId === customer.id)
    const customerReturns = returns.filter((record: any) => customerOrders.some((order: any) => order.id === record.orderId))
    const totalAmount = customerOrders.reduce((sum: number, order: any) => sum + (order.pricing?.actualAmount || 0), 0)
    const lastOrder = customerOrders[0] || null
    const monthKey = formatDate(new Date()).slice(0, 7)
    const monthAmount = customerOrders
      .filter((order: any) => String(order.createdAt || '').slice(0, 7) === monthKey)
      .reduce((sum: number, order: any) => sum + (order.pricing?.actualAmount || 0), 0)
    return {
      ...customer,
      type: customer.customerType || 'personal',
      totalAmount,
      monthAmount,
      orderCount: customerOrders.length,
      exchangeCount: customerReturns.length,
      lastOrderAt: lastOrder?.createdAt || '',
      lastOrderNo: lastOrder?.orderNo || '',
      lastOrderStatus: lastOrder?.status || '',
      boundAt: customer.boundAt || customer.createdAt || '',
    }
  })
}

export async function getAgentCustomerDetail(customerId: string) {
  const user = getCurrentUser()
  if (!user || !customerId) return null
  const customer = await getCustomerById(customerId)
  if (!customer || customer.boundSalespersonId !== user.id) return null
  const [{ data: orderDocs }, { data: returnDocs }, { data: commissionDocs }] = await Promise.all([
    db.collection('orders').where({ customerId, salespersonId: user.id }).orderBy('createdAt', 'desc').limit(100).get(),
    db.collection('returns').where({ customerId }).orderBy('createdAt', 'desc').limit(100).get(),
    db.collection('commission_records').where({ customerId, salespersonId: user.id }).orderBy('createdAt', 'desc').limit(100).get(),
  ])
  const orders = normalizeList(orderDocs)
  const returns = normalizeList(returnDocs)
  const commissions = normalizeList(commissionDocs)
  const monthKey = formatDate(new Date()).slice(0, 7)
  const totalAmount = orders.reduce((sum: number, order: any) => sum + (order.pricing?.actualAmount || 0), 0)
  const monthAmount = orders
    .filter((order: any) => String(order.createdAt || '').slice(0, 7) === monthKey)
    .reduce((sum: number, order: any) => sum + (order.pricing?.actualAmount || 0), 0)
  const commissionAmount = commissions.reduce((sum: number, record: any) => sum + (record.amount || 0), 0)
  return {
    customer: {
      ...customer,
      type: customer.customerType || 'personal',
      boundAt: customer.boundAt || customer.createdAt || '',
    },
    orders,
    returns,
    commissions,
    stats: {
      orderCount: orders.length,
      totalAmount,
      monthAmount,
      commissionAmount,
      afterSaleCount: returns.length,
    },
  }
}

export async function getAgentOrders(options?: { status?: string; customerId?: string }) {
  const user = getCurrentUser()
  if (!user) return []
  const cond: any = { salespersonId: user.id }
  if (options?.customerId) cond.customerId = options.customerId
  if (options?.status && options.status !== 'all') cond.status = options.status
  const [{ data: orderDocs }, { data: customerDocs }, { data: returnDocs }] = await Promise.all([
    db.collection('orders').where(cond).orderBy('createdAt', 'desc').limit(100).get(),
    db.collection('users').where({ role: 'customer', boundSalespersonId: user.id }).limit(100).get(),
    db.collection('returns').limit(100).get(),
  ])
  const customers = normalizeList(customerDocs)
  const returns = normalizeList(returnDocs)
  return normalizeList(orderDocs).map((order: any) => {
    const customer = customers.find((item: any) => item.id === order.customerId)
    const returnRecord = returns.find((item: any) => item.orderId === order.id)
    return {
      ...order,
      customer,
      customerType: customer?.customerType || 'personal',
      customerName: order.customerName || customer?.nickname || customer?.phone || '客户',
      returnRecord,
    }
  })
}

export async function getWithdrawalRecords(salespersonId: string) {
  const { data } = await db.collection('withdrawals').where({ salespersonId }).orderBy('appliedAt', 'desc').limit(100).get()
  return normalizeList(data)
}

export async function saveAgentBankCard(userId: string, card: any) {
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'saveAgentBankCard',
      data: { userId, card },
    }) as any
    return result || { success: false, error: '保存失败' }
  } catch (e: any) {
    return { success: false, error: e?.message || '保存失败' }
  }
}

export async function requestWithdrawal(salespersonId: string, amount: number, bankCardId: string) {
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'requestWithdrawal',
      data: { salespersonId, amount, bankCardId },
    }) as any
    return result?.success ? result.record : null
  } catch (e) {
    return null
  }
}

export async function requestWithdrawalByAmount(params: { amount: number }) {
  const user = getCurrentUser()
  if (!user) return { success: false }
  const result = await requestWithdrawal(user.id, params.amount, user.bankCards?.[0]?.id)
  return { success: !!result }
}

export async function reviewWithdrawal(id: string, approved: boolean, reviewerId: string, note: string = '') {
  const { result } = await wx.cloud.callFunction({
    name: 'reviewWithdrawal',
    data: { id, approved, reviewerId, note },
  }) as any
  if (!result?.success) {
    throw new Error(result?.error || '提现审核失败')
  }
  return result.record
}

export async function updateWithdrawalStatus(id: string, status: string, operator?: { id: string; name?: string }, note: string = '') {
  const user = getCurrentUser()
  const { result } = await wx.cloud.callFunction({
    name: 'reviewWithdrawal',
    data: {
      id,
      status,
      note,
      operatorId: operator?.id || user?.id,
      operatorName: operator?.name || user?.nickname || user?.realName || user?.username || user?.phone,
    },
  }) as any
  if (!result?.success) {
    throw new Error(result?.error || '提现状态更新失败')
  }
  return result.record
}

// ===== 代理商服务 =====

export async function submitAgentApplication(userId: string, info: any) {
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'submitAgentApplication',
      data: { userId, info },
    }) as any
    if (!result?.success) return null
    return result.user
  } catch { return null }
}

export async function getAgentApplication(userId?: string) {
  const user = userId ? null : getCurrentUser()
  const id = userId || user?.id
  if (!id) return null
  try {
    const { data } = await db.collection('users').doc(id).get()
    const u = normalize(data)
    return {
      status: u?.agentStatus || (u?.role === 'salesperson' ? 'approved' : 'none'),
      info: u?.agentApplication || {},
      user: u,
    }
  } catch { return null }
}

export async function reviewAgentApplication(userId: string, approved: boolean, rejectReason: string = '', operator?: { id: string; name?: string }) {
  const user = getCurrentUser()
  const { result } = await wx.cloud.callFunction({
    name: 'reviewAgentApplication',
    data: {
      userId,
      approved,
      rejectReason,
      operatorId: operator?.id || user?.id,
      operatorName: operator?.name || user?.nickname || user?.realName || user?.username || user?.phone,
    },
  }) as any
  if (!result?.success) {
    throw new Error(result?.error || '代理商审核失败')
  }
  return result.user
}

// ===== 用户服务 =====

export async function getCustomerById(id: string) {
  try {
    const { data } = await db.collection('users').doc(id).get()
    const u = normalize(data)
    return u?.role === 'customer' ? u : null
  } catch { return null }
}

export async function getSalespersonById(id: string) {
  try {
    const { data } = await db.collection('users').doc(id).get()
    const u = normalize(data)
    return u?.role === 'salesperson' ? u : null
  } catch { return null }
}

export async function bindSalesperson(customerId: string, salespersonId: string) {
  const { result } = await wx.cloud.callFunction({
    name: 'bindSalesperson',
    data: { customerId, salespersonId },
  })
  const res = result as any
  if (!res?.success) throw new Error(res?.error || '绑定失败')
  return res.user
}

export async function submitVerification(userId: string, info: any) {
  const now = formatDateTime(new Date())
  const basePath = `verification/${userId}/${Date.now()}`
  const businessLicense = await uploadLocalFile(info.businessLicense, `${basePath}-business-license.jpg`)
  const sitePhoto = info.sitePhoto
    ? await uploadLocalFile(info.sitePhoto, `${basePath}-site-photo.jpg`)
    : ''

  const verificationInfo = {
    ...info,
    businessLicense,
    sitePhoto,
    submittedAt: now,
    rejectReason: '',
  }

  await db.collection('users').doc(userId).update({
    data: {
      verificationStatus: 'pending',
      verificationInfo,
      updatedAt: now,
    },
  })
  try {
    const { data } = await db.collection('users').doc(userId).get()
    return normalize(data)
  } catch { return null }
}

export async function reviewVerification(userId: string, approved: boolean, rejectReason: string = '', operator?: { id: string; name?: string }) {
  const user = getCurrentUser()
  const { result } = await wx.cloud.callFunction({
    name: 'reviewVerification',
    data: {
      userId,
      approved,
      rejectReason,
      operatorId: operator?.id || user?.id,
      operatorName: operator?.name || user?.nickname || user?.realName || user?.username || user?.phone,
    },
  }) as any
  if (!result?.success) {
    throw new Error(result?.error || '认证审核失败')
  }
  return result.user
}

export async function saveAddress(customerId: string, address: any) {
  const { data: customer } = await db.collection('users').doc(customerId).get()
  const u = normalize(customer)
  if (!u) return null

  const now = formatDateTime(new Date())
  const nextAddress = {
    ...address,
    id: address.id || generateId('addr'),
    updatedAt: now,
    createdAt: address.createdAt || now,
  }
  let addresses = u.addresses || []
  if (nextAddress.isDefault) {
    addresses = addresses.map((a: any) => ({ ...a, isDefault: false }))
  }
  if (addresses.length === 0) nextAddress.isDefault = true
  const idx = addresses.findIndex((a: any) => a.id === nextAddress.id)
  if (idx >= 0) {
    addresses[idx] = { ...addresses[idx], ...nextAddress }
  } else {
    addresses.push(nextAddress)
  }
  await db.collection('users').doc(customerId).update({ data: { addresses, updatedAt: now } })
  try {
    const { data: updated } = await db.collection('users').doc(customerId).get()
    return normalize(updated)
  } catch { return null }
}

export async function deleteAddress(customerId: string, addressId: string) {
  const { data: customer } = await db.collection('users').doc(customerId).get()
  const u = normalize(customer)
  if (!u) return false
  let addresses = (u.addresses || []).filter((a: any) => a.id !== addressId)
  if (addresses.length > 0 && !addresses.some((a: any) => a.isDefault)) {
    addresses = addresses.map((a: any, index: number) => ({ ...a, isDefault: index === 0 }))
  }
  await db.collection('users').doc(customerId).update({
    data: { addresses, updatedAt: formatDateTime(new Date()) },
  })
  try {
    const { data: updated } = await db.collection('users').doc(customerId).get()
    return normalize(updated)
  } catch { return false }
}

// ===== 系统服务 =====

export async function getSystemConfig() {
  try {
    const { data } = await db.collection('config').doc('system').get()
    return normalize(data)
  } catch {
    return {
      commissionRate: 0.2, commissionLockDays: 15, minWithdrawAmount: 100,
      withdrawReviewEnabled: true, paymentTimeoutMinutes: 30, returnDeadlineDays: 7,
      returnAddress: '', reviewTimeoutHours: 24, stockWarningThreshold: 10,
      pointsRate: 1, pointsExpiryDays: 365, rechargeTiers: [],
    }
  }
}

export async function getUserNotifications(userId: string) {
  const { data } = await db.collection('notifications').where({ targetUserId: userId })
    .orderBy('createdAt', 'desc').limit(100).get()
  return normalizeList(data)
}

export async function markNotificationRead(notificationId: string) {
  await db.collection('notifications').doc(notificationId).update({ data: { isRead: true } })
}

export async function getUnreadCount(userId: string) {
  const { total } = await db.collection('notifications').where({ targetUserId: userId, isRead: false }).count()
  return total
}

// ===== 购买权限预检 =====

interface CanPurchaseResult {
  allowed: boolean; reason: string
  code?: 'not_logged_in' | 'off_sale' | 'visibility' | 'blood_pack_auth' | 'stock_insufficient' | 'purchase_limit'
}

export function canPurchase(product: any, user: any | null, options?: { quantity?: number }): CanPurchaseResult {
  const quantity = options?.quantity || 1
  if (product.status !== 'on_sale') return { allowed: false, reason: '商品已下架', code: 'off_sale' }
  if (!user) return { allowed: false, reason: '请先登录', code: 'not_logged_in' }

  const customerType = user.customerType || 'personal'
  const visibility = product.visibility || 'all'
  if (visibility === 'personal_only' && customerType !== 'personal') return { allowed: false, reason: '该商品仅限个人客户', code: 'visibility' }
  if (visibility === 'institution_only' && customerType !== 'institution') return { allowed: false, reason: '该商品仅限医院客户', code: 'visibility' }

  const isBloodPack = product.productType === 'blood_pack' || product.isBloodPack
  if (isBloodPack) {
    if (customerType !== 'institution') return { allowed: false, reason: '血包商品仅限医院客户', code: 'blood_pack_auth' }
    if (user.verificationStatus !== 'approved') return { allowed: false, reason: '请先完成医院认证', code: 'blood_pack_auth' }
  }

  if (typeof product.stock === 'number' && product.stock < quantity) return { allowed: false, reason: '库存不足', code: 'stock_insufficient' }

  const limit = product.purchaseLimit
  if (limit) {
    if (limit.minQuantity > 0 && quantity < limit.minQuantity) return { allowed: false, reason: `最少购买 ${limit.minQuantity} 件`, code: 'purchase_limit' }
    if (limit.maxQuantityPerOrder > 0 && quantity > limit.maxQuantityPerOrder) return { allowed: false, reason: `单笔最多 ${limit.maxQuantityPerOrder} 件`, code: 'purchase_limit' }
  }

  return { allowed: true, reason: '' }
}

// ===== 购物车（本地存储，不走云数据库） =====

const CART_KEY = 'cart_items'

export function addToCart(item: any) {
  const cart = getCartItems()
  const existing = cart.find((c: any) => c.productId === item.productId && c.spec === item.spec)
  if (existing) {
    existing.quantity += item.quantity || 1
  } else {
    cart.push({ ...item, quantity: item.quantity || 1 })
  }
  wx.setStorageSync(CART_KEY, JSON.stringify(cart))
}

export function getCartItems(): any[] {
  const str = wx.getStorageSync(CART_KEY) as string
  if (str) {
    try { return JSON.parse(str) } catch { return [] }
  }
  return []
}

export function clearCart() {
  wx.removeStorageSync(CART_KEY)
}

// ===== 优惠券服务 =====

export async function getAvailableCoupons(options?: { productId?: string; categoryId?: string }) {
  const user = getCurrentUser()
  if (!user) return []
  const now = formatDateTime(new Date())
  const cond: any = { userId: user.id, status: 'available' }
  const { data } = await db.collection('user_coupons').where(cond).orderBy('createdAt', 'desc').limit(100).get()
  const coupons = normalizeList(data)
  // 过滤有效期
  return coupons.filter((c: any) => {
    if (c.validFrom && now < c.validFrom) return false
    if (c.validTo && now > c.validTo) return false
    if (options?.productId && c.scope === 'products' && !c.scopeIds.includes(options.productId)) return false
    if (options?.categoryId && c.scope === 'categories' && !c.scopeIds.includes(options.categoryId)) return false
    return true
  })
}

export async function getUserCoupons(status?: string) {
  const user = getCurrentUser()
  if (!user) return []
  const cond: any = { userId: user.id }
  if (status && status !== 'all') cond.status = status
  const { data } = await db.collection('user_coupons').where(cond).orderBy('createdAt', 'desc').limit(100).get()
  return normalizeList(data)
}

export function calculateCouponDiscount(coupon: any, items: any[], totalAmount: number) {
  if (!coupon) return { canUse: false, discountAmount: 0, reason: '未选择优惠券' }
  if (coupon.status !== 'available') return { canUse: false, discountAmount: 0, reason: '优惠券不可用' }
  if (coupon.minAmount > 0 && totalAmount < coupon.minAmount) {
    return { canUse: false, discountAmount: 0, reason: `未满 ¥${coupon.minAmount}` }
  }
  // 适用范围检查
  if (coupon.scope === 'products') {
    const match = items.some((item: any) => coupon.scopeIds.includes(item.productId))
    if (!match) return { canUse: false, discountAmount: 0, reason: '不适用于当前商品' }
  }

  let discount = 0
  if (coupon.couponType === 'fixed') {
    discount = Math.min(coupon.couponValue, totalAmount - 0.01)
  } else if (coupon.couponType === 'discount') {
    discount = Math.round(totalAmount * (1 - coupon.couponValue / 10) * 100) / 100
  } else if (coupon.couponType === 'full_reduction') {
    if (totalAmount >= coupon.minAmount) {
      discount = Math.min(coupon.couponValue, totalAmount - 0.01)
    }
  }
  return { canUse: true, discountAmount: Math.max(0, discount), reason: '' }
}

export async function claimCoupon(templateId: string) {
  const { result } = await wx.cloud.callFunction({
    name: 'manageCoupon',
    data: { action: 'claimCoupon', templateId },
  }) as any
  if (!result?.success) {
    throw new Error(result?.error || '领取失败')
  }
  return result.coupon
}

export async function getClaimableCoupons() {
  const now = formatDateTime(new Date())
  const { data } = await db.collection('coupon_templates')
    .where({ status: 'active', distributeMethod: 'user_claim' })
    .orderBy('createdAt', 'desc').limit(50).get()
  return normalizeList(data).filter((t: any) => !t.validTo || t.validTo > now)
}
