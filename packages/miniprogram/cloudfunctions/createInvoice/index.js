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

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return error('登录状态无效', 'UNAUTHORIZED')

  const title = String(event.title || '').trim()
  const email = String(event.email || '').trim()
  if (!title) return error('请填写发票抬头')
  if (!email) return error('请填写接收邮箱')

  const order = await getOrder(event.orderId)
  if (!order) return error('订单不存在', 'NOT_FOUND')
  if (order.customerOpenid && order.customerOpenid !== openid) return error('只能申请自己的订单发票', 'FORBIDDEN')
  if (!order.customerOpenid && order._openid !== openid) return error('只能申请自己的订单发票', 'FORBIDDEN')
  if (!order.payment || order.payment.status !== 'paid') return error('订单支付后才能申请发票')

  const existing = await db.collection('invoices').where({ orderId: order._id }).limit(1).get()
  if (existing.data && existing.data.length > 0) {
    return { success: false, code: 'DUPLICATED', error: '该订单已提交过发票申请', invoice: { ...existing.data[0], id: existing.data[0]._id } }
  }

  const now = formatDateTime(new Date())
  const record = {
    customerId: order.customerId,
    customerOpenid: order.customerOpenid || openid,
    orderId: order._id,
    orderNo: order.orderNo,
    invoiceType: event.invoiceType === 'paper' ? 'paper' : 'electronic',
    title,
    taxNo: String(event.taxNo || '').trim(),
    email,
    amount: order.pricing && typeof order.pricing.actualAmount === 'number' ? order.pricing.actualAmount : 0,
    status: 'pending',
    remark: String(event.remark || '').trim(),
    createdAt: now,
    updatedAt: now,
  }

  const { _id } = await db.collection('invoices').add({ data: record })
  return { success: true, invoice: { ...record, id: _id } }
}
