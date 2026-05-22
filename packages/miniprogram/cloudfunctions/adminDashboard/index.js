const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const defaultSystemConfig = {
  commissionRate: 0.2,
  commissionLockDays: 15,
  minWithdrawAmount: 100,
  withdrawReviewEnabled: true,
  paymentTimeoutMinutes: 30,
  returnDeadlineDays: 7,
  returnAddress: '',
  reviewTimeoutHours: 24,
  stockWarningThreshold: 10,
  pointsRate: 1,
  pointsExpiryDays: 365,
  rechargeTiers: [],
  referralRewardPoints: 500,
}

function error(message, code = 'BAD_REQUEST') {
  return { success: false, code, error: message }
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [body, signature] = token.split('.')
  const secret = process.env.ADMIN_SESSION_SECRET || 'dxdy-admin-session-secret-v1'
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  if (signature !== expected) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch (e) {
    return null
  }
}

function normalize(doc) {
  if (!doc || typeof doc !== 'object') return null
  const { _id, id, _openid, boundOpenid, ...rest } = doc
  return { ...rest, id: String(_id || id || '') }
}

async function readCollection(name) {
  const { data } = await db.collection(name).orderBy('createdAt', 'desc').limit(500).get()
  return (data || []).map(normalize).filter(Boolean)
}

exports.main = async (event) => {
  const payload = verifyToken(event.token)
  if (!payload || payload.role !== 'system_admin') return error('登录状态无效或无权访问仪表盘', 'UNAUTHORIZED')

  const [orders, returns, products, users] = await Promise.all([
    readCollection('orders'),
    readCollection('returns'),
    readCollection('products'),
    readCollection('users'),
  ])

  let config = defaultSystemConfig
  try {
    const { data } = await db.collection('config').doc('system').get()
    config = data ? { ...defaultSystemConfig, ...normalize(data) } : defaultSystemConfig
  } catch (e) {
    config = defaultSystemConfig
  }

  return {
    success: true,
    data: {
      orders,
      returns,
      products: products.filter(product => !product.isDeleted && !product.deletedAt),
      customers: users.filter(user => user.role === 'customer'),
      config,
    },
  }
}
