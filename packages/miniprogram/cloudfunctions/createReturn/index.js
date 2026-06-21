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

async function getReturnConfig() {
  try {
    const { data: configDoc } = await db.collection('config').doc('system').get()
    return {
      returnDeadlineDays: (configDoc && typeof configDoc.returnDeadlineDays === 'number')
        ? configDoc.returnDeadlineDays : 7,
    }
  } catch (_e) {
    return { returnDeadlineDays: 7 }
  }
}

async function hasBloodProduct(items) {
  for (const item of items) {
    if (/血/.test(item.productName || '')) return true
    try {
      const { data: product } = await db.collection('products').doc(item.productId).get()
      if (product && (product.productType === 'blood_pack' || product.isBloodPack)) return true
    } catch (_e) { /* skip */ }
  }
  return false
}

function normalizeItems(order, eventItems) {
  const source = Array.isArray(eventItems) && eventItems.length ? eventItems : order.items || []
  const orderItems = Array.isArray(order.items) ? order.items : []
  return source.map((item) => ({
    ...(() => {
      const matched = orderItems.find((orderItem) => (
        String(orderItem.productId || '') === String(item.productId || '') ||
        String(orderItem.productName || '') === String(item.productName || '')
      )) || {}
      const quantity = Math.max(1, Number(item.quantity || matched.quantity || 1))
      const unitPrice = Number(item.unitPrice || matched.unitPrice || 0)
      return {
        productImage: item.productImage || item.imageUrl || matched.productImage || matched.imageUrl || '',
        totalPrice: Number(item.totalPrice || matched.totalPrice || (unitPrice * quantity)),
      }
    })(),
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

  const existing = await db.collection('returns')
    .where({ orderId: order._id })
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get()
  const blockingStatuses = ['pending_review', 'approved', 'customer_shipping', 'received', 'refunding', 'exchange_shipping', 'return_completed', 'exchange_completed']
  const blockingRecord = (existing.data || []).find((item) => blockingStatuses.includes(item.status))
  if (blockingRecord) {
    return { success: false, code: 'DUPLICATED', error: '该订单已有售后申请，请先查看售后进度', record: { ...blockingRecord, id: blockingRecord._id } }
  }

  // 售后期限校验：订单完成时间 + returnDeadlineDays
  const config = await getReturnConfig()
  const completedAt = order.completedAt || order.updatedAt || order.createdAt || ''
  if (completedAt && order.status === 'completed') {
    const completedDate = new Date(completedAt.replace(/-/g, '/'))
    const deadline = new Date(completedDate.getTime() + config.returnDeadlineDays * 24 * 60 * 60 * 1000)
    if (new Date() > deadline) {
      return error(`售后申请期限已过（${config.returnDeadlineDays}天）`)
    }
  }

  // 售后原因类型
  const validReasonTypes = ['quality', 'change_of_mind', 'other']
  const reasonType = validReasonTypes.includes(event.reasonType) ? event.reasonType : 'other'

  // 血包商品规则：仅支持质量问题售后
  const items = normalizeItems(order, event.items)
  const isBloodOrder = await hasBloodProduct(items)
  if (isBloodOrder && reasonType !== 'quality') {
    return error('血包商品仅支持质量问题售后')
  }
  if (isBloodOrder && event.type === 'exchange') {
    return error('血包商品不支持换货，请选择退货退款')
  }

  if (event.type === 'refund_only') {
    return error('当前不支持仅退款，请选择退货退款或换货', 'UNSUPPORTED_RETURN_TYPE')
  }

  const now = formatDateTime(new Date())
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
    type: ['refund_return', 'exchange'].includes(event.type) ? event.type : 'refund_return',
    status: 'pending_review',
    reasonType,
    bloodPackCode: isBloodOrder ? String(event.bloodPackCode || '').trim() : '',
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
