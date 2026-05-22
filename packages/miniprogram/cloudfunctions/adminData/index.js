const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const READABLE_COLLECTIONS = new Set([
  'analytics_daily',
  'card_vouchers',
  'categories',
  'commission_records',
  'config',
  'coupon_templates',
  'invoices',
  'logs',
  'orders',
  'product_reviews',
  'reviews',
  'products',
  'returns',
  'test_reports',
  'user_coupons',
  'users',
  'withdrawals',
])

const WRITABLE_COLLECTIONS = new Set([
  'card_vouchers',
  'categories',
  'config',
  'logs',
  'products',
  'users',
])

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

function canRead(role, collection) {
  if (role === 'system_admin') return true
  if (role === 'product_manager') return ['products', 'categories'].includes(collection)
  if (role === 'service') {
    return ['orders', 'returns', 'users', 'withdrawals', 'invoices', 'products', 'categories'].includes(collection)
  }
  return false
}

function canWrite(role, collection) {
  if (role === 'system_admin') return true
  if (role === 'product_manager') return ['products', 'categories'].includes(collection)
  return false
}

function assertPlainObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback
}

function normalizeDoc(doc) {
  if (!doc || typeof doc !== 'object') return null
  const { _openid, boundOpenid, ...rest } = doc
  return rest
}

function applyField(query, field) {
  const projection = assertPlainObject(field, null)
  return projection ? query.field(projection) : query
}

exports.main = async (event = {}) => {
  const payload = verifyToken(event.token)
  if (!payload) return error('登录状态无效，请重新登录', 'UNAUTHORIZED')

  const action = String(event.action || '')

  if (action === 'getAdminStatus') {
    const id = String(event.id || payload.id || '')
    if (!id) return error('缺少账号 ID')
    const { data } = await db.collection('users').doc(id).get()
    const doc = normalizeDoc(data)
    return { success: true, data: doc ? { id: String(doc._id || doc.id || ''), status: doc.status || 'active' } : null }
  }

  const collection = String(event.collection || '')
  if (!READABLE_COLLECTIONS.has(collection)) return error('不允许访问该集合', 'FORBIDDEN')

  if (['list', 'get', 'count'].includes(action)) {
    if (!canRead(payload.role, collection)) return error('无权读取该数据', 'FORBIDDEN')
  } else if (['add', 'set', 'update', 'remove', 'updateWhere'].includes(action)) {
    if (!WRITABLE_COLLECTIONS.has(collection) || !canWrite(payload.role, collection)) {
      return error('无权修改该数据', 'FORBIDDEN')
    }
  } else {
    return error('未知后台数据操作')
  }

  if (action === 'list') {
    let query = db.collection(collection)
    const where = assertPlainObject(event.query, null)
    if (where) query = query.where(where)
    query = applyField(query, event.field)
    const orderBy = assertPlainObject(event.orderBy, { field: 'createdAt', direction: 'desc' })
    if (orderBy.field) query = query.orderBy(String(orderBy.field), orderBy.direction === 'asc' ? 'asc' : 'desc')
    const limit = Math.min(Math.max(Number(event.limit || 500), 1), 1000)
    const { data } = await query.limit(limit).get()
    return { success: true, data: (data || []).map(normalizeDoc).filter(Boolean) }
  }

  if (action === 'get') {
    const id = String(event.id || '')
    if (!id) return error('缺少文档 ID')
    let ref = db.collection(collection).doc(id)
    ref = applyField(ref, event.field)
    const { data } = await ref.get()
    return { success: true, data: normalizeDoc(data) }
  }

  if (action === 'count') {
    let query = db.collection(collection)
    const where = assertPlainObject(event.query, null)
    if (where) query = query.where(where)
    const { total } = await query.count()
    return { success: true, data: total || 0 }
  }

  const data = assertPlainObject(event.data)

  if (action === 'add') {
    const result = await db.collection(collection).add({ data })
    return { success: true, data: { id: result._id || data._id || data.id || '' } }
  }

  if (action === 'set') {
    const id = String(event.id || data._id || data.id || '')
    if (!id) return error('缺少文档 ID')
    await db.collection(collection).doc(id).set({ data })
    return { success: true, data: { id } }
  }

  if (action === 'update') {
    const id = String(event.id || '')
    if (!id) return error('缺少文档 ID')
    await db.collection(collection).doc(id).update({ data })
    return { success: true, data: { id } }
  }

  if (action === 'remove') {
    const id = String(event.id || '')
    if (!id) return error('缺少文档 ID')
    await db.collection(collection).doc(id).remove()
    return { success: true, data: { id } }
  }

  if (action === 'updateWhere') {
    const where = assertPlainObject(event.query, null)
    if (!where) return error('缺少查询条件')
    await db.collection(collection).where(where).update({ data })
    return { success: true, data: true }
  }
}
