const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

function parseDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  const text = String(value).trim()
  if (!text) return null
  const date = new Date(text.includes('T') ? text : text.replace(' ', 'T'))
  if (!Number.isNaN(date.getTime())) return date
  const fallback = new Date(text.replace(/-/g, '/'))
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

function formatDateTime(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

async function getSystemConfig() {
  try {
    const { data } = await db.collection('config').doc('system').get()
    return data || {}
  } catch (_e) {
    return {}
  }
}

async function getSystemOperator() {
  const { data } = await db.collection('users').where({
    role: _.in(['system_admin', 'admin']),
    status: _.neq('disabled'),
  }).limit(1).get()
  return data && data[0] ? data[0] : null
}

function getPendingPaymentBaseTime(order) {
  return parseDate(order?.pendingPaymentAt)
    || parseDate(order?.confirmedAt)
    || parseDate(order?.createdAt)
}

exports.main = async (event = {}) => {
  const config = await getSystemConfig()
  const minutes = Math.max(0, Number(event.paymentTimeoutMinutes ?? config.paymentTimeoutMinutes ?? 30))
  if (!minutes) return { success: true, paymentTimeoutMinutes: minutes, scanned: 0, cancelled: 0, skipped: 0, results: [] }

  const operator = await getSystemOperator()
  if (!operator) {
    return { success: false, code: 'NO_SYSTEM_OPERATOR', error: '未找到可用于自动取消订单的系统管理员账号' }
  }

  const limit = Math.min(Math.max(Number(event.limit || 100), 1), 500)
  const now = new Date()
  const cutoff = now.getTime() - minutes * 60 * 1000
  const { data } = await db.collection('orders').where({
    status: 'pending_payment',
  }).limit(limit).get()

  const results = []
  let cancelled = 0
  let skipped = 0

  for (const order of (data || [])) {
    const baseTime = getPendingPaymentBaseTime(order)
    if (!baseTime || baseTime.getTime() > cutoff) {
      skipped++
      continue
    }

    const response = await cloud.callFunction({
      name: 'updateOrderStatus',
      data: {
        orderId: order._id,
        status: 'cancelled',
        operatorId: operator._id,
        operatorName: '系统自动取消',
        autoCancel: true,
      },
    })
    const result = response.result || {}
    if (result.success) cancelled++
    else skipped++
    results.push({
      orderId: order._id,
      orderNo: order.orderNo || '',
      pendingPaymentAt: formatDateTime(baseTime),
      success: !!result.success,
      error: result.error || '',
    })
  }

  return {
    success: true,
    paymentTimeoutMinutes: minutes,
    cutoff: formatDateTime(new Date(cutoff)),
    scanned: (data || []).length,
    cancelled,
    skipped,
    results,
  }
}
