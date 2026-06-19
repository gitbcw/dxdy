/**
 * 云开发服务层 —— 替代原 shared/src mock 层
 * 所有数据通过 wx.cloud.database() 读写
 */

// ===== 数据库初始化 =====
const db = wx.cloud.database()
const _ = db.command

export const GENERATED_ASSETS = {
  loginHero: '/assets/generated/optimized/login-vet-hero.jpg',
  loginFullscreen: '/assets/generated/optimized/login-fullscreen-bg-v3.png',
  homeBanner: '/assets/generated/optimized/home-vet-banner.jpg',
  bloodBag: '/assets/generated/optimized/product-blood-bag.webp',
  vaccineKit: '/assets/generated/optimized/product-vaccine-kit.webp',
  testCard: '/assets/generated/optimized/product-test-card.webp',
  coldChain: '/assets/generated/optimized/cold-chain-logistics.webp',
  testTraceability: '/assets/generated/optimized/product-test-card.webp',
  agentPromotion: '/assets/generated/optimized/home-vet-banner.jpg',
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
  const directDelivery = shipping.directDelivery || {}
  const isUrgentBooking = order.type === 'booking' && !!(order.booking?.urgent || shipping.urgent)
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
    status: order.status === 'pending_receipt' ? 'shipped' : order.status === 'preparing' ? 'preparing' : order.status === 'completed' ? 'signed' : 'pending',
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
    isUrgentBooking,
    deliveryMode: shipping.deliveryMode || '',
    directDelivery,
    departedAt: directDelivery.departedAt || '',
    estimatedArrivalAt: directDelivery.estimatedArrivalAt || shipping.eta || '',
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
  const d = typeof date === 'string' ? new Date(date.replace(' ', 'T')) : date
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date.replace(' ', 'T')) : date
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

/** 判断商品是否处于促销期 */
export function isOnPromotion(product: any, now?: Date): boolean {
  if (!product?.promotionPrice || product.promotionPrice <= 0) return false
  if (!product.promotionStart || !product.promotionEnd) return false
  const t = now || new Date()
  const start = new Date(product.promotionStart.replace(/-/g, '/'))
  const end = new Date(product.promotionEnd.replace(/-/g, '/'))
  return t >= start && t <= end
}

/** 获取商品有效价格（促销价优先） */
export function getEffectivePrice(product: any, customerTypeOrUser?: string | { customerType?: string }): number {
  if (isOnPromotion(product)) return Number(product.promotionPrice)
  const ct = typeof customerTypeOrUser === 'string'
    ? customerTypeOrUser
    : customerTypeOrUser?.customerType || 'personal'
  if (ct === 'institution') return Number(product.institutionPrice || product.personalPrice || 0)
  return Number(product.personalPrice || product.institutionPrice || 0)
}

/** 积分过期延迟检查 — 过滤已过期历史记录，重算余额 */
export function checkPointsExpiry(user: any, expiryDays?: number): { balance: number; history: any[] } {
  const days = expiryDays || 365
  if (!days || days <= 0) return { balance: user?.points?.balance || 0, history: user?.points?.history || [] }
  const now = Date.now()
  const history = (user?.points?.history || []).filter((entry: any) => {
    if (entry.change < 0) return true  // 消耗记录不过期
    const created = new Date(entry.createdAt.replace(/-/g, '/')).getTime()
    return (now - created) < days * 86400000
  })
  const balance = history.reduce((sum: number, entry: any) => sum + entry.change, 0)
  return { balance: Math.max(0, balance), history }
}

export function getProductVisualImage(productOrName: any): string {
  const firstImage = Array.isArray(productOrName?.images) ? productOrName.images[0] : ''
  if (firstImage && typeof firstImage === 'string' && !firstImage.startsWith('data:image/')) return firstImage

  const name = typeof productOrName === 'string'
    ? productOrName
    : String(productOrName?.name || productOrName?.productName || '')
  if (productOrName?.isBloodPack || /血|红细胞|血包/.test(name)) return GENERATED_ASSETS.bloodBag
  if (/检测|试纸|检验|报告/.test(name)) return GENERATED_ASSETS.testCard
  return GENERATED_ASSETS.vaccineKit
}

// ===== 认证服务 =====

export async function loginByPhone(phone: string, options: { password?: string, demo?: boolean } = {}) {
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'loginByPhone',
      data: { phone, password: options.password || '', demo: options.demo === true },
    }) as any
    if (result?.success && result.user) {
      const user = result.user
      wx.setStorageSync('current_user', JSON.stringify(user))
      return { success: true, user }
    }
    return { success: false, error: result?.error || '用户不存在' }
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

function inferUserRole(user: any): string {
  if (!user) return ''
  if (user.role === 'customer') return user.customerType === 'institution' ? 'customer_institution' : 'customer_personal'
  return user.role || ''
}

function persistCurrentUser(user: any) {
  const app = getApp()
  app.globalData.userInfo = user
  app.globalData.userRole = inferUserRole(user)
  app.globalData.authResolved = true
  wx.setStorageSync('current_user', JSON.stringify(user))
  wx.setStorageSync('user_role', app.globalData.userRole)
}

export async function ensureOpenidUser(options?: { referralCode?: string }) {
  try {
    const openid = getCurrentOpenid()
    if (!openid) return { success: false, error: 'openid unavailable' }

    const cached = getCurrentUser()
    if (cached?.id || cached?._id) {
      return { success: true, user: cached }
    }


    const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
    if (data && data.length > 0) {
      const user = normalize(data[0])
      persistCurrentUser(user)
      return { success: true, user }
    }

    let referredBy = ''
    if (options?.referralCode) {
      const { data: referrers } = await db.collection('users').where({ referralCode: options.referralCode }).limit(1).get()
      if (referrers && referrers.length) referredBy = String(referrers[0]._id || '')
    }

    const user = {
      phone: '',
      nickname: '微信用户',
      avatar: '',
      role: 'customer',
      customerType: 'personal',
      verificationStatus: 'none',
      boundSalespersonId: null,
      wallet: { balance: 0, rechargeHistory: [] },
      points: { balance: 0, history: [] },
      addresses: [] as any[],
      referralCode: '',
      ...(referredBy ? { referredBy, referredAt: formatDate(new Date()) } : {}),
      createdAt: formatDate(new Date()),
    }
    const { _id } = await db.collection('users').add({ data: user })
    const result = { ...user, id: _id }
    persistCurrentUser(result)
    return { success: true, user: result }
  } catch (err) {
    return { success: false, error: '用户初始化失败' }
  }
}

export async function bindCustomerPhone(phone: string) {
  if (!/^1\d{10}$/.test(phone)) return { success: false, error: '请输入正确手机号' }

  try {
    const app = getApp()
    const current = app.globalData.userInfo || getCurrentUser()
    const { data: existing } = await db.collection('users').where({ phone }).limit(1).get()

    if (existing && existing.length > 0) {
      const user = normalize(existing[0])
      persistCurrentUser(user)
      return { success: true, user }
    }

    if (current?.id || current?._id) {
      const userId = current.id || current._id
      const patch = {
        phone,
        nickname: current.nickname || `用户${phone.slice(-4)}`,
        role: current.role || 'customer',
        customerType: current.customerType || 'personal',
        updatedAt: formatDate(new Date()),
      }
      await db.collection('users').doc(userId).update({ data: patch })
      const user = { ...current, ...patch, id: userId }
      persistCurrentUser(user)
      return { success: true, user }
    }

    return registerCustomer(phone, `用户${phone.slice(-4)}`)
  } catch (err) {
    return { success: false, error: '绑定手机号失败' }
  }
}

export function requireBoundPhone(user: any): boolean {
  if (user?.phone) return true

  const pages = getCurrentPages()
  const current = pages[pages.length - 1]
  const route = current?.route || ''
  wx.showToast({ title: user ? '请先绑定手机号' : '请先登录', icon: 'none' })

  if (route !== 'pages/login/login') {
    setTimeout(() => {
      wx.navigateTo({ url: '/pages/login/login' })
    }, 300)
  }

  return false
}

export async function registerCustomer(phone: string, nickname: string, customerType: string = 'personal', referralCode?: string) {
  try {
    const { data: existing } = await db.collection('users').where({ phone }).get()
    if (existing.length > 0) {
      return { success: false, error: '该手机号已注册' }
    }

    // 处理推荐码
    let referredBy = ''
    if (referralCode) {
      const { data: referrers } = await db.collection('users').where({ referralCode }).limit(1).get()
      if (referrers && referrers.length) {
        referredBy = String(referrers[0]._id || '')
      }
    }

    const user = {
      phone, nickname, avatar: '', role: 'customer', customerType,
      verificationStatus: 'none', boundSalespersonId: null,
      wallet: { balance: 0, rechargeHistory: [] },
      points: { balance: 200, history: [{ id: generateId('pts'), change: 200, balance: 200, reason: '注册赠送', createdAt: formatDate(new Date()) }] },
      addresses: [] as any[],
      referralCode: '',
      ...(referredBy ? { referredBy, referredAt: formatDate(new Date()) } : {}),
      createdAt: formatDate(new Date()),
    }
    const { _id } = await db.collection('users').add({ data: user })

    // 生成推荐码
    const code = `R${String(_id).slice(-6).toUpperCase()}`
    await db.collection('users').doc(_id).update({ data: { referralCode: code } })

    const result = { ...user, id: _id, referralCode: code }
    wx.setStorageSync('current_user', JSON.stringify(result))
    return { success: true, user: result }
  } catch (err) {
    return { success: false, error: '注册失败' }
  }
}

// ===== 商品服务 =====

export async function registerAccount(params: {
  phone: string
  password: string
  registerType: 'personal' | 'institution' | 'agent'
  nickname?: string
  referralCode?: string
}) {
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'registerCustomer',
      data: {
        action: 'register',
        phone: params.phone,
        password: params.password,
        registerType: params.registerType,
        nickname: params.nickname || '',
        referralCode: params.referralCode || '',
      },
    }) as any
    if (result?.success && result.user) {
      const user = result.user
      const app = getApp()
      app.globalData.userInfo = user
      app.globalData.userRole = app.resolveRole?.(user) || inferUserRole(user)
      app.globalData.authResolved = true
      wx.setStorageSync('current_user', JSON.stringify(user))
      wx.setStorageSync('user_role', app.globalData.userRole)
      return { success: true, user, registerType: result.registerType || params.registerType }
    }
    return { success: false, error: result?.error || '注册失败' }
  } catch (err) {
    return { success: false, error: '注册失败' }
  }
}

function normalizeProductVisibility(visibility: any): string {
  const value = String(visibility || '').trim()
  if (!value || value === 'all' || value === 'public') return 'all'
  if (value === 'institution' || value === 'institution_only' || value === 'hospital') return 'institution_only'
  if (value === 'personal' || value === 'personal_only') return 'personal_only'
  return 'all'
}

function getUserDefaultCity(): string {
  const user = getCurrentUser()
  if (!user?.addresses || !Array.isArray(user.addresses) || user.addresses.length === 0) return ''
  const defaultAddr = user.addresses.find((a: any) => a.isDefault) || user.addresses[0]
  return String(defaultAddr?.city || '').trim()
}

function normalizeCity(value: string): string {
  return String(value || '').replace(/(省|市|特别行政区|自治区|地区|自治州|盟)$/, '').trim()
}

function isRegionVisible(product: any, city: string): boolean {
  if (!city) return true
  const normalizedCity = normalizeCity(city)
  const match = (regions: string[]) => regions.some((region) => normalizeCity(region) === normalizedCity)
  const hidden = Array.isArray(product?.hiddenRegions) ? product.hiddenRegions : []
  if (hidden.length && match(hidden)) return false
  const visible = Array.isArray(product?.visibleRegions) ? product.visibleRegions : []
  if (visible.length && !match(visible)) return false
  return true
}

export function canViewProduct(product: any, visibility?: string): boolean {
  const viewer = normalizeProductVisibility(visibility || 'all')
  const city = getUserDefaultCity()
  const regionVisible = isRegionVisible(product, city)
  if (!regionVisible) return false

  if (viewer === 'all') return true

  const productVisibility = normalizeProductVisibility(product?.visibility)
  if (viewer === 'institution_only') return productVisibility === 'all' || productVisibility === 'institution_only'
  if (viewer === 'personal_only') return productVisibility === 'all' || productVisibility === 'personal_only'
  return true
}

const PRODUCT_LIST_FIELDS = {
  _id: true,
  name: true,
  images: true,
  category: true,
  specs: true,
  institutionPrice: true,
  personalPrice: true,
  visibility: true,
  stock: true,
  salesCount: true,
  serviceTags: true,
  status: true,
  returnPolicy: true,
  isPrescription: true,
  isBloodPack: true,
  testInfoUrl: true,
  productType: true,
  bookingConfig: true,
  urgentConfig: true,
  purchaseLimit: true,
  agreementRequired: true,
  salesCountEnabled: true,
  deliveryConfig: true,
  visibleRegions: true,
  hiddenRegions: true,
  redeemableCategory: true,
  validDays: true,
  promotionPrice: true,
  promotionStart: true,
  promotionEnd: true,
  createdAt: true,
  updatedAt: true,
}

export async function getProducts(options?: { visibility?: string; categoryId?: string; keyword?: string }) {
  const cond: any = { status: 'on_sale' }
  if (options?.categoryId) cond.category = options.categoryId
  if (options?.keyword) {
    cond.name = db.RegExp({ regexp: options.keyword, options: 'i' })
  }
  const { data } = await db.collection('products').where(cond).field(PRODUCT_LIST_FIELDS).limit(100).get()
  return normalizeList(data)
    .map((product: any) => ({ ...product, visibility: normalizeProductVisibility(product.visibility) }))
    .filter((product: any) => canViewProduct(product, options?.visibility))
}

export async function getProductById(id: string) {
  try {
    const { data } = await db.collection('products').where({ _id: id }).field(PRODUCT_LIST_FIELDS).limit(1).get()
    return data?.[0] ? normalize(data[0]) : null
  } catch { return null }
}

export async function getCategories() {
  const { data } = await db.collection('categories').orderBy('sort', 'asc').limit(100).get()
  return normalizeList(data)
}

const ARTICLE_LIST_FIELDS = {
  _id: true,
  title: true,
  subtitle: true,
  coverUrl: true,
  articleUrl: true,
  tag: true,
  status: true,
  sort: true,
  clickCount: true,
  viewCount: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
}

export async function getOfficialArticles(limit = 4) {
  const { data } = await db.collection('articles')
    .where({ status: 'active' })
    .field(ARTICLE_LIST_FIELDS)
    .orderBy('clickCount', 'desc')
    .orderBy('sort', 'asc')
    .orderBy('publishedAt', 'desc')
    .limit(limit)
    .get()
  return normalizeList(data)
}

export async function recordArticleClick(articleId: string, title: string, source: 'home' | 'list') {
  const tracking = require('./tracking')
  tracking.trackArticleClick(articleId, title, source)
  try {
    await db.collection('articles').doc(articleId).update({
      data: {
        clickCount: _.inc(1),
        updatedAt: new Date().toISOString(),
      },
    })
  } catch (e) {
    // 点击计数失败不应阻塞用户跳转，静默忽略
    console.error('recordArticleClick failed', e)
  }
}

// ===== 订单服务 =====

export async function getOrders(options?: { customerId?: string; salespersonId?: string; clerkId?: string; status?: string }) {
  const user = getCurrentUser()
  const { result } = await wx.cloud.callFunction({
    name: 'queryOrders',
    data: { action: 'listOrders', operatorId: user?.id, ...(options || {}) },
  }) as any
  if (!result?.success) throw new Error(result?.error || '订单读取失败')
  return result.orders || []
}

export async function getOrderById(id: string) {
  const user = getCurrentUser()
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'queryOrders',
      data: { action: 'getOrderById', orderId: id, operatorId: user?.id },
    }) as any
    return result?.success ? result.order : null
  } catch { return null }
}

export async function queryLogistics(orderId: string) {
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'queryLogistics',
      data: { orderId, userId: getCurrentUser()?.id },
    }) as any
    return result || { success: false, error: '物流查询失败' }
  } catch (e: any) {
    return { success: false, error: e?.message || '物流查询失败' }
  }
}

export async function queryWxExpressOrder(params: { orderId?: string; waybillNo?: string; trackingNo?: string }) {
  const { result } = await wx.cloud.callFunction({
    name: 'queryWxExpressOrder',
    data: {
      ...params,
      operatorId: getCurrentUser()?.id,
    },
  }) as any
  if (!result?.success) {
    throw new Error(result?.error || '微信物流订单查询失败')
  }
  return result
}

export async function getOrderByNo(orderNo: string) {
  const user = getCurrentUser()
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'queryOrders',
      data: { action: 'getOrderByNo', orderNo, operatorId: user?.id },
    }) as any
    return result?.success ? result.order : null
  } catch { return null }
}

export async function deleteOrder(orderId: string) {
  const user = getCurrentUser()
  const { result } = await wx.cloud.callFunction({
    name: 'queryOrders',
    data: { action: 'deleteOrder', orderId, operatorId: user?.id },
  }) as any
  if (!result?.success) {
    throw new Error(result?.error || '订单删除失败')
  }
  return result
}

export async function createOrder(params: {
  customerId: string; items: any[]; type: string
  booking?: any; shippingAddress?: any; remark?: string; couponId?: string; isUrgent?: boolean; pointsToUse?: number; source?: string; fromCart?: boolean
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

export async function payOrder(orderId: string, method: string = 'wechat', options?: { cardVoucherId?: string }) {
  const { result } = await wx.cloud.callFunction({
    name: 'payOrder',
    data: { orderId, method, ...(options || {}) },
  }) as any
  if (result?.success && method === 'wechat' && result.payRequest) {
    const payRes = await (wx.cloud as any).callHTTPFunction({
      name: 'daxiongdongyi-nrignywh-demo-scfweb',
      config: { env: 'cloud1-d7g7ctn4m86bada89' },
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      path: '/wx-pay/wxpay_order',
      data: result.payRequest,
    })
    const body = payRes?.data
    if (body?.code !== 0) {
      return { success: false, error: body?.msg || '微信支付下单失败', order: result.order }
    }
    const payment = body?.data?.data || body?.data
    if (!payment?.timeStamp || !payment?.nonceStr || !payment?.package || !payment?.paySign || !payment?.signType) {
      return { success: false, error: body?.msg || '微信支付参数缺失', order: result.order }
    }
    result.payment = payment
  }
  if (result?.success && result.user) {
    const app = getApp()
    app.globalData.userInfo = result.user
    app.globalData.userRole = app.resolveRole?.(result.user) || app.globalData.userRole
    wx.setStorageSync('current_user', JSON.stringify(result.user))
  }
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
  const user = getCurrentUser()
  if (!user || user.role !== 'clerk') return []

  const { result } = await wx.cloud.callFunction({
    name: 'queryOrders',
    data: { action: 'listOrders', operatorId: user.id, clerkId: user.id },
  }) as any
  if (!result?.success) throw new Error(result?.error || '制单员订单读取失败')

  const status = options?.status
  const today = formatDate(new Date())
  return (result.orders || [])
    .filter((order: any) => {
      if (status === 'pending') return ['pending_shipment', 'confirmed', 'preparing'].includes(order.status)
      if (status === 'shipped') return order.status === 'pending_receipt'
      if (status === 'signed') return order.status === 'completed'
      if (status === 'today_shipped') {
        return order.status === 'pending_receipt' && String(order.shipping?.shippedAt || '').startsWith(today)
      }
      return true
    })
    .map(mapClerkOrder)
}

export async function getClerkOrderById(id: string) {
  const user = getCurrentUser()
  if (!user || user.role !== 'clerk') return null
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'queryOrders',
      data: { action: 'getOrderById', orderId: id, operatorId: user.id },
    }) as any
    return result?.success ? mapClerkOrder(result.order) : null
  } catch {
    return null
  }
}

export async function clerkShipOrder(params: {
  orderId: string
  expressCompany?: string
  expressNo?: string
  deliveryMode?: string
  estimatedArrivalAt?: string
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
  return updateOrderStatus(orderId, 'preparing')
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

const EMPTY_COMMISSION_SUMMARY = {
  total: 0,
  available: 0,
  withdrawable: 0,
  withdrawn: 0,
  pending: 0,
  pendingDeduction: 0,
  pendingLock: 0,
}

async function getCommissionRecordsFromDatabase(salespersonId: string) {
  const { data } = await db.collection('commission_records').where({ salespersonId }).orderBy('createdAt', 'desc').limit(100).get()
  return normalizeList(data)
}

export async function getAgentCommissionOverview() {
  const user = getCurrentUser()
  if (!user) return { summary: { ...EMPTY_COMMISSION_SUMMARY }, records: [] }
  if (user.role !== 'salesperson' && user.role !== 'agent') {
    const commission = user.commission || {}
    return {
      summary: {
        ...EMPTY_COMMISSION_SUMMARY,
        total: commission.total || 0,
        available: commission.available || 0,
        withdrawable: commission.available || 0,
        withdrawn: commission.withdrawn || 0,
        pending: commission.pendingDeduction || 0,
        pendingDeduction: commission.pendingDeduction || 0,
      },
      records: [],
    }
  }
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'toggleSalesmanCustomerFocus',
      data: {
        action: 'commissions',
        userId: user.id,
      },
    }) as any
    if (result?.success) {
      return {
        summary: { ...EMPTY_COMMISSION_SUMMARY, ...(result.summary || {}) },
        records: normalizeList(result.records || []),
      }
    }
  } catch (e) {
    console.warn('getAgentCommissionOverview failed, fallback to local cache', e)
  }

  try {
    const records = await getCommissionRecordsFromDatabase(user.id)
    return {
      summary: buildCommissionSummaryFromRecords(records, user.commission || {}),
      records: records.filter((record: any) => record.status !== 'cancelled'),
    }
  } catch (e) {
    console.warn('getCommissionRecords fallback failed', e)
    const commission = user.commission || {}
    return {
      summary: {
        ...EMPTY_COMMISSION_SUMMARY,
        total: commission.total || 0,
        available: commission.available || 0,
        withdrawable: commission.available || 0,
        withdrawn: commission.withdrawn || 0,
        pending: commission.pendingDeduction || 0,
        pendingDeduction: commission.pendingDeduction || 0,
      },
      records: [],
    }
  }
}

function getCommissionSignedAmount(record: any): number {
  const amount = Number(record?.signedAmount ?? record?.amount ?? 0) || 0
  if (record?.status === 'deducted' || record?.sourceType === 'return_deduction') return -Math.abs(amount)
  return amount
}

function buildCommissionSummaryFromRecords(records: any[], commission: any) {
  const summary = {
    ...EMPTY_COMMISSION_SUMMARY,
    available: Number(commission.available || 0),
    withdrawable: Number(commission.available || 0),
    withdrawn: Number(commission.withdrawn || 0),
    pendingDeduction: Number(commission.pendingDeduction || 0),
  }
  for (const record of records || []) {
    if (!record || record.status === 'cancelled') continue
    const signedAmount = getCommissionSignedAmount(record)
    summary.total += signedAmount
    if (record.status === 'pending' || record.status === 'locked') {
      summary.pending += Math.max(0, signedAmount)
      summary.pendingLock += Math.max(0, signedAmount)
    }
  }
  summary.total = Math.max(0, Math.round(summary.total * 100) / 100)
  summary.pending = Math.max(0, Math.round(summary.pending * 100) / 100)
  summary.pendingLock = Math.max(0, Math.round(summary.pendingLock * 100) / 100)
  return summary
}

export async function getCommissionRecords(salespersonId: string) {
  const user = getCurrentUser()
  if (user?.id === salespersonId) {
    const overview = await getAgentCommissionOverview()
    return overview.records
  }
  return getCommissionRecordsFromDatabase(salespersonId)
}

export async function getCommissionSummary() {
  const overview = await getAgentCommissionOverview()
  return overview.summary
}

export async function getSalesmanCustomers() {
  const user = getCurrentUser()
  if (!user) return []
  const { result } = await wx.cloud.callFunction({
    name: 'toggleSalesmanCustomerFocus',
    data: {
      action: 'customers',
      userId: user.id,
    },
  }) as any
  return result?.success ? (result.customers || []) : []
}

export async function getSalesmanCustomerFocusRecords() {
  const user = getCurrentUser()
  if (!user) return []
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'toggleSalesmanCustomerFocus',
      data: {
        action: 'list',
        userId: user.id,
      },
    }) as any
    return result?.success ? normalizeList(result.focusRecords) : []
  } catch {
    return []
  }
}

export async function toggleSalesmanCustomerFocus(customerId: string) {
  const user = getCurrentUser()
  if (!user || !customerId) return { focused: false }
  const { result } = await wx.cloud.callFunction({
    name: 'toggleSalesmanCustomerFocus',
    data: {
      customerId,
      userId: user.id,
    },
  }) as any
  if (!result?.success) {
    throw new Error(result?.error || '重点关注操作失败')
  }
  return { focused: result.focused }
}

export async function getAgentCustomerDetail(customerId: string) {
  const user = getCurrentUser()
  if (!user || !customerId) return null
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'toggleSalesmanCustomerFocus',
      data: {
        action: 'detail',
        customerId,
        userId: user.id,
      },
    }) as any
    return result?.success ? result.detail : null
  } catch {
    return null
  }
}

export async function getAgentOrders(options?: { status?: string; customerId?: string }) {
  const user = getCurrentUser()
  if (!user) return []
  options = options || {}
  {
  const [{ result }, customers] = await Promise.all([
    wx.cloud.callFunction({
      name: 'queryOrders',
      data: {
        action: 'listOrders',
        operatorId: user.id,
        customerId: options?.customerId || '',
        status: options?.status && options.status !== 'all' ? options.status : '',
      },
    }) as any,
    getSalesmanCustomers(),
  ])
  if (!result?.success) return []
  const customerIds = new Set(customers.map((item: any) => item.id).filter(Boolean))
  return (result.orders || []).filter((order: any) => {
    if (order.type === 'card_order') return false
    if (!customerIds.has(order.customerId)) return false
    if (options?.customerId && order.customerId !== options.customerId) return false
    return true
  }).map((order: any) => {
    const customer = customers.find((item: any) => item.id === order.customerId)
    return {
      ...order,
      customer,
      customerType: customer?.customerType || 'personal',
      customerName: order.customerName || customer?.nickname || customer?.phone || '客户',
    }
  })
  }
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

export async function deleteAgentBankCard(userId: string, cardId: string) {
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'saveAgentBankCard',
      data: { action: 'delete', userId, cardId },
    }) as any
    return result || { success: false, error: '删除失败' }
  } catch (e: any) {
    return { success: false, error: e?.message || '删除失败' }
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

export function isApprovedAgent(user: any) {
  return user?.agentStatus === 'approved' || user?.role === 'salesperson'
}

export async function submitAgentApplication(userId: string, info: any) {
  try {
    const basePath = `agent-applications/${userId}/${Date.now()}`
    const idCardFront = await uploadLocalFile(info.idCardFront, `${basePath}-id-card-front.jpg`)
    const idCardBack = await uploadLocalFile(info.idCardBack, `${basePath}-id-card-back.jpg`)
    const { result } = await wx.cloud.callFunction({
      name: 'submitAgentApplication',
      data: { userId, info: { ...info, idCardFront, idCardBack } },
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
    if (!userId && user) {
      const approved = isApprovedAgent(user)
      const fallbackInfo = approved ? {
        contactName: user?.agentApplication?.contactName || user?.verificationInfo?.realName || user?.nickname || '',
        contactPhone: user?.agentApplication?.contactPhone || user?.phone || '',
        submittedAt: user?.agentApplication?.submittedAt || user?.agentApprovedAt || user?.updatedAt || user?.createdAt || '',
        idNumber: user?.agentApplication?.idNumber || user?.verificationInfo?.idCard || '',
        idCardFront: user?.agentApplication?.idCardFront || '',
        idCardBack: user?.agentApplication?.idCardBack || '',
      } : {}
      return {
        status: user?.agentStatus || (approved ? 'approved' : 'none'),
        info: { ...fallbackInfo, ...(user?.agentApplication || {}) },
        user,
      }
    }

    let u: any = null
    try {
      const { data } = await db.collection('users').doc(id).get()
      u = normalize(data)
    } catch (_e) {
      u = null
    }

    if ((!u || (!u.agentStatus && u.role !== 'salesperson')) && user?.phone) {
      const { data } = await db.collection('users').where({ phone: user.phone }).limit(1).get()
      if (data && data.length > 0) u = normalize(data[0])
    }
    if (!u) return null

    const approved = isApprovedAgent(u)
    const fallbackInfo = approved ? {
      contactName: u?.agentApplication?.contactName || u?.verificationInfo?.realName || u?.nickname || '',
      contactPhone: u?.agentApplication?.contactPhone || u?.phone || '',
      submittedAt: u?.agentApplication?.submittedAt || u?.agentApprovedAt || u?.updatedAt || u?.createdAt || '',
      idNumber: u?.agentApplication?.idNumber || u?.verificationInfo?.idCard || '',
      idCardFront: u?.agentApplication?.idCardFront || '',
      idCardBack: u?.agentApplication?.idCardBack || '',
    } : {}
    return {
      status: u?.agentStatus || (approved ? 'approved' : 'none'),
      info: { ...fallbackInfo, ...(u?.agentApplication || {}) },
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
  const user = getCurrentUser()
  const { result } = await wx.cloud.callFunction({
    name: 'manageAddress',
    data: {
      action: 'saveAddress',
      customerId,
      operatorId: user?.id,
      address,
    },
  }) as any
  if (!result?.success) {
    throw new Error(result?.error || '地址保存失败')
  }
  return result.user
}

export async function deleteAddress(customerId: string, addressId: string) {
  const user = getCurrentUser()
  const { result } = await wx.cloud.callFunction({
    name: 'manageAddress',
    data: {
      action: 'deleteAddress',
      customerId,
      operatorId: user?.id,
      addressId,
    },
  }) as any
  if (!result?.success) {
    throw new Error(result?.error || '地址删除失败')
  }
  return result.user
}

// ===== 系统服务 =====

export async function getSystemConfig() {
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'getSystemConfig',
    }) as any
    return result?.config || {
      commissionRate: 0.2, commissionLockDays: 15, minWithdrawAmount: 100,
      withdrawReviewEnabled: true, paymentTimeoutMinutes: 30, returnDeadlineDays: 7,
      returnAddress: '', reviewTimeoutHours: 24, stockWarningThreshold: 10,
      pointsRate: 1, pointsExpiryDays: 365, rechargeTiers: [],
    }
  } catch {
    return {
      commissionRate: 0.2, commissionLockDays: 15, minWithdrawAmount: 100,
      withdrawReviewEnabled: true, paymentTimeoutMinutes: 30, returnDeadlineDays: 7,
      returnAddress: '', reviewTimeoutHours: 24, stockWarningThreshold: 10,
      pointsRate: 1, pointsExpiryDays: 365, rechargeTiers: [],
    }
  }
}

export async function createBloodBookingInvite() {
  const user = getCurrentUser()
  const { result } = await wx.cloud.callFunction({
    name: 'manageBloodBookingInvite',
    data: { action: 'create', userId: user?.id || user?._id || '' },
  }) as any
  if (!result?.success) throw new Error(result?.error || '生成预约二维码失败')
  if (!result.invite?.qrcodeUrl && result.invite?.id) {
    const codeResult = await manageCardVoucher({ action: 'bloodInviteCode', inviteId: result.invite.id, userId: user?.id || user?._id || '' })
    result.invite.qrcodeFileId = codeResult.fileID || ''
    result.invite.qrcodeUrl = codeResult.fileID || ''
  }
  return result.invite
}

export async function getBloodBookingInvite(inviteId: string) {
  const { result } = await wx.cloud.callFunction({
    name: 'manageBloodBookingInvite',
    data: { action: 'get', inviteId },
  }) as any
  if (!result?.success) throw new Error(result?.error || '预约二维码无效')
  return result.invite
}

export async function getBloodCommissionRecords() {
  const user = getCurrentUser()
  const { result } = await wx.cloud.callFunction({
    name: 'manageBloodBookingInvite',
    data: { action: 'listCommissions', userId: user?.id || user?._id || '' },
  }) as any
  if (!result?.success) throw new Error(result?.error || '读取医院佣金失败')
  return normalizeList(result.records || [])
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
    if (user.verificationStatus !== 'approved') return { allowed: false, reason: '请先完成门店认证', code: 'blood_pack_auth' }
  }

  const isCardVoucher = product.productType === 'card_voucher'
  if (isCardVoucher && user.role !== 'salesperson') return { allowed: false, reason: '卡券仅限代理商购买', code: 'visibility' }

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
const CART_VERSION_KEY = 'cart_version'
const CART_CLEAR_FLAG = 'cart_cleared_after_submit'
const CART_MIGRATED_KEY = 'cart_cloud_migrated'

function getCartSnapshotKey() {
  const user = getCurrentUser()
  const identity = user?.id || user?._id || getCurrentOpenid() || 'anonymous'
  return `${CART_KEY}_${identity}`
}

function getCartMigratedKey() {
  const user = getCurrentUser()
  const identity = user?.id || user?._id || getCurrentOpenid() || 'anonymous'
  return `${CART_MIGRATED_KEY}_${identity}`
}

function readCartSnapshot(): any[] {
  const keys = [getCartSnapshotKey(), CART_KEY]
  for (const key of keys) {
    const stored = wx.getStorageSync(key) as any
    if (Array.isArray(stored)) return stored
    if (stored) {
      try { return JSON.parse(stored) } catch { /* try next */ }
    }
  }
  return []
}

function bumpCartVersion() {
  const version = Date.now()
  wx.setStorageSync(CART_VERSION_KEY, version)
  getApp().globalData.cartVersion = version
  return version
}

export function getCartVersion(): number {
  return Number(wx.getStorageSync(CART_VERSION_KEY) || getApp().globalData.cartVersion || 0)
}

export function saveCartItems(items: any[]) {
  const safeItems = items || []
  wx.setStorageSync(getCartSnapshotKey(), JSON.stringify(safeItems))
  wx.setStorageSync(CART_KEY, JSON.stringify(safeItems))
  bumpCartVersion()
}

async function callCart(action: string, data: Record<string, any> = {}) {
  const { result } = await wx.cloud.callFunction({
    name: 'manageCart',
    data: { action, ...data },
  }) as any
  if (!result?.success) {
    throw new Error(result?.error || '购物车操作失败')
  }
  const items = Array.isArray(result.cart?.items) ? result.cart.items : []
  saveCartItems(items)
  wx.setStorageSync(getCartMigratedKey(), '1')
  wx.removeStorageSync(CART_CLEAR_FLAG)
  return items
}

export async function addToCart(item: any, quantity?: number) {
  const count = Math.max(1, Number(quantity || item.quantity || 1))
  const productId = item.productId || item.id || item._id
  const spec = item.spec || item.specs?.[0]?.value || ''
  return callCart('addItem', { item: { ...item, productId, spec }, quantity: count, spec })
}

export async function getCartItems(): Promise<any[]> {
  if (wx.getStorageSync(CART_CLEAR_FLAG)) return []
  const snapshot = readCartSnapshot()
  const migrated = !!wx.getStorageSync(getCartMigratedKey())
  const items = await callCart('getCart')
  if (!migrated && items.length === 0 && snapshot.length > 0) {
    return callCart('syncCart', { items: snapshot })
  }
  return items
}

export async function updateCartItem(productId: string, spec: string, quantity: number) {
  return callCart('updateQuantity', { productId, spec, quantity })
}

export async function removeCartItem(productId: string, spec: string = '') {
  return callCart('removeItem', { productId, spec })
}

export async function clearCart() {
  wx.removeStorageSync(getCartSnapshotKey())
  wx.removeStorageSync(CART_KEY)
  wx.setStorageSync(getCartSnapshotKey(), JSON.stringify([]))
  wx.setStorageSync(CART_KEY, JSON.stringify([]))
  wx.setStorageSync(getCartMigratedKey(), '1')
  bumpCartVersion()
  try {
    await callCart('clearCart')
  } catch (_e) {
    // Keep the local UI empty; the next cloud refresh will retry/surface the issue.
  }
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

// ===== 卡券服务 =====

export async function getAgentCards() {
  const user = getCurrentUser()
  if (!user || user.role !== 'salesperson') return []
  const { data } = await db.collection('card_vouchers')
    .where({ purchaserId: user.id })
    .orderBy('createdAt', 'desc').limit(100).get()
  const cards = normalizeList(data)
  // 惰性过期检查
  const now = formatDateTime(new Date())
  for (const card of cards) {
    if (['ungifted', 'gifted', 'claimed'].includes(card.status) && card.expiresAt && card.expiresAt < now) {
      await db.collection('card_vouchers').doc(card.id).update({ data: { status: 'expired', updatedAt: now } })
      card.status = 'expired'
    }
  }
  return cards
}

export async function getMyCards() {
  const { result } = await wx.cloud.callFunction({
    name: 'manageCardVoucher',
    data: { action: 'listMine' },
  }) as any
  if (!result?.success) return []
  return result.cards || []
}

export async function getGiftedCards() {
  const { result } = await wx.cloud.callFunction({
    name: 'manageCardVoucher',
    data: { action: 'listMine', status: 'gifted' },
  }) as any
  if (!result?.success) return []
  return result.cards || []
}

export async function getCardById(id: string) {
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'manageCardVoucher',
      data: { action: 'get', cardId: id },
    }) as any
    return result?.success ? result.card : null
  } catch { return null }
}

export async function getRedeemableProducts(categoryId: string) {
  const cond: any = {
    productType: 'blood_pack',
    status: 'on_sale',
  }
  if (categoryId) cond.category = categoryId
  const { data } = await db.collection('products')
    .where(cond)
    .orderBy('createdAt', 'desc').limit(100).get()
  return normalizeList(data)
}

export async function getCardVoucherProducts() {
  const { data } = await db.collection('products')
    .where({
      productType: 'card_voucher',
      status: 'on_sale',
    })
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get()
  return normalizeList(data)
}

export async function manageCardVoucher(params: {
  action: 'gift' | 'claim' | 'regift' | 'redeem' | 'void' | 'shareCode' | 'claimShared' | 'bloodInviteCode' | 'agentPromoCode' | 'recordAgentPromoVisit' | 'agentPromoStats'
  cardId?: string
  inviteId?: string
  userId?: string
  referralCode?: string
  toUserId?: string
  redeemProductId?: string
  shippingAddress?: any
  voidReason?: string
}) {
  const { result } = await wx.cloud.callFunction({
    name: 'manageCardVoucher',
    data: params,
  }) as any
  if (!result?.success) {
    throw new Error(result?.error || '操作失败')
  }
  return result
}

export async function sendSmsCode(phone: string, scene: string = 'login') {
  const { result } = await wx.cloud.callFunction({
    name: 'sendSms',
    data: { action: 'sendCode', phone, scene },
  }) as any
  return result || { success: false, error: '短信发送失败' }
}

export async function resetPassword(params: { phone: string; code: string; newPassword: string }) {
  const { result } = await wx.cloud.callFunction({
    name: 'resetPassword',
    data: params,
  }) as any
  return result || { success: false, error: '重置失败' }
}
