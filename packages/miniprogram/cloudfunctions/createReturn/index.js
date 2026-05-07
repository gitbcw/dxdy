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

function error(message, code = 'BAD_REQUEST') {
  return { success: false, code, error: message }
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

function normalizeItems(order, eventItems) {
  const source = Array.isArray(eventItems) && eventItems.length ? eventItems : order.items || []
  return source.map((item) => ({
    productId: item.productId || '',
    productName: item.productName || '',
    quantity: Math.max(1, Number(item.quantity || 1)),
    unitPrice: Number(item.unitPrice || 0),
    spec: item.spec || '',
  }))
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return error('登录状态无效', 'UNAUTHORIZED')

  const reason = String(event.reason || '').trim()
  if (!reason) return error('请填写售后原因')

  const order = await getOrder(event.orderId)
  if (!order) return error('订单不存在', 'NOT_FOUND')
  if (order.customerOpenid && order.customerOpenid !== openid) return error('只能申请自己的订单售后', 'FORBIDDEN')
  if (!order.customerOpenid && order._openid !== openid) return error('只能申请自己的订单售后', 'FORBIDDEN')
  if (order.status === 'pending_payment' || order.status === 'cancelled') return error('当前订单状态不可申请售后')

  const existing = await db.collection('returns').where({ orderId: order._id }).limit(1).get()
  if (existing.data && existing.data.length > 0) {
    return { success: false, code: 'DUPLICATED', error: '该订单已提交过售后申请', record: { ...existing.data[0], id: existing.data[0]._id } }
  }

  const now = formatDateTime(new Date())
  const items = normalizeItems(order, event.items)
  const maxRefund = order.pricing && typeof order.pricing.actualAmount === 'number'
    ? order.pricing.actualAmount
    : items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const requestedRefund = typeof event.refundAmount === 'number' ? event.refundAmount : maxRefund
  const refundAmount = Math.max(0, Math.min(maxRefund, requestedRefund))
  const record = {
    afterNo: `SH${Date.now()}`,
    orderId: order._id,
    customerId: order.customerId,
    customerOpenid: order.customerOpenid || openid,
    type: ['refund_return', 'refund_only', 'exchange'].includes(event.type) ? event.type : 'refund_return',
    status: 'pending_review',
    reason,
    description: String(event.description || '').trim(),
    vouchers: Array.isArray(event.vouchers) ? event.vouchers : [],
    items,
    refundAmount,
    ...(event.exchangeItem ? { exchangeItem: event.exchangeItem } : {}),
    sendLogistics: null,
    receiveLogistics: null,
    verificationResult: 'pending',
    commissionAdjust: { amount: 0, reason: '' },
    reviewerId: null,
    reviewNote: '',
    timeline: [
      { status: 'submitted', title: '提交申请', time: now, desc: '客户已提交售后申请' },
      { status: 'pending_review', title: '商家审核中', time: now, desc: '等待客服审核凭证与订单信息' },
    ],
    createdAt: now,
    updatedAt: now,
  }

  const { _id } = await db.collection('returns').add({ data: record })
  await db.collection('orders').doc(order._id).update({
    data: { returnRecordId: _id, updatedAt: now },
  })
  return { success: true, record: { ...record, id: _id } }
}
