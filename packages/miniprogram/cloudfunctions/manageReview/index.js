const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

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

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return error('登录状态无效', 'UNAUTHORIZED')

  const action = event.action
  const now = formatDateTime(new Date())

  if (action === 'submitReview') {
    const { orderId, productId, rating, content, images } = event
    if (!orderId || !productId) return error('参数缺失')
    if (!rating || rating < 1 || rating > 5) return error('请选择评分（1-5）')

    // 获取用户
    const { data: users } = await db.collection('users').where({ _openid: openid }).limit(1).get()
    if (!users || !users.length) return error('用户不存在', 'FORBIDDEN')
    const user = users[0]

    // 验证订单
    const { data: order } = await db.collection('orders').doc(orderId).get()
    if (!order) return error('订单不存在')
    if (order.customerId !== user._id) return error('只能评价自己的订单')
    if (order.status !== 'completed') return error('只有已完成订单可评价')

    // 检查是否已评价
    const { data: existing } = await db.collection('product_reviews').where({
      orderId,
      productId,
      userId: user._id,
    }).limit(1).get()
    if (existing && existing.length) return error('该商品已评价')

    // 获取商品信息
    const { data: product } = await db.collection('products').doc(productId).get()
    if (!product) return error('商品不存在')

    const review = {
      orderId,
      productId,
      productName: product.name,
      productImage: (product.images && product.images[0]) || '',
      userId: user._id,
      userOpenid: openid,
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

  if (action === 'approveReview' || action === 'rejectReview') {
    const { reviewId } = event
    if (!reviewId) return error('参数缺失')

    const { data: admin } = await db.collection('users').where({ _openid: openid, role: _.in(['admin', 'system_admin']) }).limit(1).get()
    if (!admin || !admin.length) return error('无权限', 'FORBIDDEN')

    const status = action === 'approveReview' ? 'approved' : 'rejected'
    await db.collection('product_reviews').doc(reviewId).update({
      data: { status, updatedAt: now }
    })
    return { success: true }
  }

  if (action === 'replyReview') {
    const { reviewId, reply } = event
    if (!reviewId) return error('参数缺失')

    const { data: admin } = await db.collection('users').where({ _openid: openid, role: _.in(['admin', 'system_admin']) }).limit(1).get()
    if (!admin || !admin.length) return error('无权限', 'FORBIDDEN')

    await db.collection('product_reviews').doc(reviewId).update({
      data: { adminReply: String(reply || '').slice(0, 300), updatedAt: now }
    })
    return { success: true }
  }

  return error('未知操作')
}
