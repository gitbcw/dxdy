const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const ADMIN_REVIEW_ROLES = ['admin', 'system_admin', 'service', 'product_manager']

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateTime(date) {
  return `${formatDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function error(message, code = 'BAD_REQUEST') {
  return { success: false, code, error: message }
}

function normalizeReview(review) {
  const rating = Math.max(1, Math.min(5, Number(review.rating || 5)))
  return {
    id: review._id,
    _id: review._id,
    orderId: review.orderId || '',
    productId: review.productId || '',
    productName: review.productName || '',
    productImage: review.productImage || '',
    userNickname: review.userNickname || '用户',
    userAvatar: review.userAvatar || '',
    rating,
    content: review.content || '',
    images: Array.isArray(review.images) ? review.images : [],
    adminReply: review.adminReply || '',
    status: review.status || '',
    createdAt: review.createdAt || '',
    updatedAt: review.updatedAt || '',
  }
}

function verifyAdminToken(token) {
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

async function getAdminUser(openid, token) {
  const payload = verifyAdminToken(token)
  if (payload && ADMIN_REVIEW_ROLES.includes(payload.role)) {
    try {
      const { data } = await db.collection('users').doc(payload.id).get()
      if (data && ADMIN_REVIEW_ROLES.includes(data.role) && data.status !== 'disabled') return data
    } catch (e) {
      return { _id: payload.id, username: payload.username, role: payload.role }
    }
  }

  if (!openid) return null
  const { data } = await db.collection('users').where({
    _openid: openid,
    role: _.in(ADMIN_REVIEW_ROLES),
  }).limit(1).get()
  return data && data[0] ? data[0] : null
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const action = event.action
  const now = formatDateTime(new Date())

  if (action === 'submitReview') {
    if (!openid) return error('登录状态无效', 'UNAUTHORIZED')
    const { orderId, productId, rating, content, images } = event
    if (!orderId || !productId) return error('参数缺失')
    if (!rating || rating < 1 || rating > 5) return error('请选择评分（1-5）')

    const { data: users } = await db.collection('users').where({ _openid: openid }).limit(1).get()
    if (!users || !users.length) return error('用户不存在', 'FORBIDDEN')
    const user = users[0]

    const { data: order } = await db.collection('orders').doc(orderId).get()
    if (!order) return error('订单不存在')
    if (order.customerId !== user._id) return error('只能评价自己的订单')
    if (order.status !== 'completed') return error('只有已完成订单可评价')

    const { data: existing } = await db.collection('product_reviews').where({
      orderId,
      productId,
      userId: user._id,
    }).limit(1).get()
    if (existing && existing.length) return error('该商品已评价')

    const { data: product } = await db.collection('products').doc(productId).get()
    if (!product) return error('商品不存在')

    const review = {
      orderId,
      productId,
      productName: product.name,
      productImage: (product.images && product.images[0]) || '',
      userId: user._id,
      userNickname: user.nickname || user.phone || '用户',
      userAvatar: user.avatar || '',
      rating: Number(rating),
      content: String(content || '').slice(0, 500),
      images: Array.isArray(images) ? images.slice(0, 6) : [],
      status: 'pending',
      adminReply: '',
      createdAt: now,
      updatedAt: now,
    }

    const { _id } = await db.collection('product_reviews').add({ data: review })
    return { success: true, review: { ...review, id: _id } }
  }

  if (action === 'listApprovedReviews') {
    const productId = String(event.productId || '').trim()
    if (!productId) return error('参数缺失')
    const limit = Math.max(1, Math.min(50, Number(event.limit || 20)))

    const { data } = await db.collection('product_reviews').where({
      productId,
      status: 'approved',
    }).orderBy('createdAt', 'desc').limit(limit).get()

    const reviews = (data || []).map(normalizeReview)
    const averageRating = reviews.length
      ? Math.round(reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length * 10) / 10
      : 0

    return {
      success: true,
      reviews,
      count: reviews.length,
      averageRating,
    }
  }

  if (action === 'approveReview' || action === 'rejectReview') {
    const { reviewId } = event
    if (!reviewId) return error('参数缺失')

    const admin = await getAdminUser(openid, event.token)
    if (!admin) return error('无权限', 'FORBIDDEN')

    const status = action === 'approveReview' ? 'approved' : 'rejected'
    await db.collection('product_reviews').doc(reviewId).update({
      data: { status, updatedAt: now },
    })
    return { success: true }
  }

  if (action === 'replyReview') {
    const { reviewId, reply } = event
    if (!reviewId) return error('参数缺失')

    const admin = await getAdminUser(openid, event.token)
    if (!admin) return error('无权限', 'FORBIDDEN')

    await db.collection('product_reviews').doc(reviewId).update({
      data: { adminReply: String(reply || '').slice(0, 300), updatedAt: now },
    })
    return { success: true }
  }

  return error('未知操作')
}
