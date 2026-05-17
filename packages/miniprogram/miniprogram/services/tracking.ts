/**
 * 用户行为埋点 SDK
 * 批量缓冲 → 每 10 条或 30 秒刷新 → 写入 tracking_events_batch 集合
 */

const BUFFER_SIZE = 10
const FLUSH_INTERVAL = 30000
const STORAGE_KEY = 'tracking_session'

interface TrackEvent {
  eventId: string
  eventType: string
  userId: string
  pagePath: string
  timestamp: string
  properties: Record<string, any>
}

let sessionId = ''
let userId = ''
let buffer: TrackEvent[] = []
let timer: ReturnType<typeof setInterval> | null = null
let flushing = false
let disabled = false

function generateId(prefix = 'evt') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function ensureSession() {
  if (sessionId) return
  const stored = wx.getStorageSync(STORAGE_KEY) as string
  if (stored) {
    const parsed = JSON.parse(stored)
    // 会话有效期 30 分钟
    if (parsed.ts && Date.now() - parsed.ts < 30 * 60 * 1000) {
      sessionId = parsed.sid
      return
    }
  }
  sessionId = generateId('sess')
  wx.setStorageSync(STORAGE_KEY, JSON.stringify({ sid: sessionId, ts: Date.now() }))
}

function startTimer() {
  if (timer) return
  timer = setInterval(() => { flush() }, FLUSH_INTERVAL)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

export function init(options?: { userId?: string }) {
  ensureSession()
  if (options?.userId) userId = options.userId
  startTimer()
}

export function setUserId(uid: string) {
  userId = uid
}

export function track(eventType: string, properties: Record<string, any> = {}) {
  if (disabled) return
  ensureSession()
  buffer.push({
    eventId: generateId('evt'),
    eventType,
    userId,
    pagePath: properties._pagePath || '',
    timestamp: new Date().toISOString(),
    properties,
  })
  delete properties._pagePath

  if (buffer.length >= BUFFER_SIZE) {
    flush()
  }
}

export function trackPageView(pagePath: string, properties: Record<string, any> = {}) {
  track('page_view', { ...properties, _pagePath: pagePath })
}

export function trackProductView(productId: string, productName: string, price: number, productType?: string) {
  track('product_view', { productId, productName, price, productType, _pagePath: 'product-detail' })
}

export function trackAddToCart(productId: string, productName: string, price: number, quantity: number, source?: string) {
  track('add_to_cart', { productId, productName, price, quantity, source, _pagePath: 'product-detail' })
}

export function trackOrderSubmit(orderId: string, orderAmount: number, itemCount: number) {
  track('order_submit', { orderId, orderAmount, itemCount, _pagePath: 'orders/create' })
}

export function trackOrderPay(orderId: string, orderAmount: number, paymentMethod: string) {
  track('order_pay', { orderId, orderAmount, paymentMethod, _pagePath: 'orders/pay-result' })
}

export function trackReviewSubmit(productId: string, orderId: string, rating?: number) {
  track('review_submit', { productId, orderId, rating, _pagePath: 'reviews/submit' })
}

export function trackReferralShare(referralCode: string) {
  track('referral_share', { referralCode, _pagePath: 'referral/share' })
}

export function trackSearch(keyword: string, resultCount: number) {
  track('search', { searchKeyword: keyword, searchResultCount: resultCount, _pagePath: 'catalog' })
}

export async function flush() {
  if (disabled || flushing || buffer.length === 0) return
  flushing = true
  const batch = buffer.splice(0)
  try {
    const db = wx.cloud.database()
    await db.collection('tracking_events_batch').add({
      data: {
        sessionId,
        events: batch.map(e => ({ ...e, userId: userId || e.userId })),
        createdAt: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    const message = String(error?.errMsg || error?.message || '')
    if (message.includes('collection not exists') || message.includes('Db or Table not exist')) {
      disabled = true
      stopTimer()
    } else {
      buffer.unshift(...batch)
    }
  } finally {
    flushing = false
  }
}

export function pause() {
  stopTimer()
  flush()
}

export function resume() {
  // 更新会话时间戳
  wx.setStorageSync(STORAGE_KEY, JSON.stringify({ sid: sessionId, ts: Date.now() }))
  startTimer()
}
