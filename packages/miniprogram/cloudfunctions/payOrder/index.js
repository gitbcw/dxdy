const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateTime(date) {
  return `${formatDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function error(message, code = 'BAD_REQUEST', order = null) {
  return { success: false, code, error: message, ...(order ? { order } : {}) }
}

async function getOrder(orderId) {
  if (!orderId) return null
  try {
    const { data } = await db.collection('orders').doc(orderId).get()
    return data || null
  } catch (e) {
    return null
  }
}

function isOwner(order, openid) {
  if (order.customerOpenid) return order.customerOpenid === openid
  return order._openid === openid
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return error('登录状态无效', 'UNAUTHORIZED')

  const order = await getOrder(event.orderId)
  if (!order) return error('订单不存在', 'NOT_FOUND')
  if (!isOwner(order, openid)) return error('只能支付自己的订单', 'FORBIDDEN')
  if (order.status !== 'pending_payment') return error('仅待支付订单可支付', 'INVALID_STATUS', { ...order, id: order._id })

  const actualAmount = order.pricing && typeof order.pricing.actualAmount === 'number'
    ? order.pricing.actualAmount
    : 0
  if (actualAmount <= 0) return error('订单金额异常')

  const method = ['wechat', 'wallet', 'offline'].includes(event.method) ? event.method : 'wechat'
  const paidAt = formatDateTime(new Date())
  const nextStatus = order.type === 'booking' ? 'pending_confirmation' : 'pending_shipment'
  const transactionId = `PAY${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`

  await db.collection('orders').doc(order._id).update({
    data: {
      status: nextStatus,
      payment: {
        status: 'paid',
        method,
        paidAt,
        transactionId,
        amount: actualAmount,
      },
      updatedAt: paidAt,
    },
  })

  const updated = await getOrder(order._id)
  return { success: true, order: { ...updated, id: updated._id } }
}
