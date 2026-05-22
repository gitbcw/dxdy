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

async function getCurrentUser(openid, operatorId) {
  if (!openid && operatorId) {
    try {
      const { data: user } = await db.collection('users').doc(operatorId).get()
      return user || null
    } catch (e) {
      return null
    }
  }

  const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
  if (data && data.length) return data[0]

  const { data: boundUsers } = await db.collection('users').where({ boundOpenid: openid }).limit(1).get()
  if (boundUsers && boundUsers.length) return boundUsers[0]

  if (!operatorId) return null
  try {
    const { data: user } = await db.collection('users').doc(operatorId).get()
    if (!user) return null
    if (user._openid && user._openid !== openid) return null
    if (user.boundOpenid && user.boundOpenid !== openid) return null
    if (['admin', 'system_admin', 'service'].includes(user.role)) {
      await db.collection('users').doc(user._id).update({
        data: { boundOpenid: openid, updatedAt: formatDateTime(new Date()) },
      })
      return { ...user, boundOpenid: openid }
    }
    return user
  } catch (e) {
    return null
  }
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

function canAdjustPrice(user) {
  if (!user) return false
  if (['admin', 'system_admin'].includes(user.role)) return true
  if (user.role !== 'service') return false
  return !user.permissions || user.permissions.order_price_adjust === true || user.permissions.manage_orders === true
}

function getOperatorName(user, fallback) {
  return fallback || user.realName || user.nickname || user.name || user.username || '客服'
}

async function getCommissionRate() {
  try {
    const { data: configDoc } = await db.collection('config').doc('system').get()
    if (configDoc && typeof configDoc.commissionRate === 'number') return configDoc.commissionRate
  } catch (_e) { /* use default */ }
  return 0.2
}

async function calcCommission(order, newPrice) {
  const currentAmount = order.commission && typeof order.commission.amount === 'number'
    ? order.commission.amount
    : 0
  const currentActual = order.pricing && typeof order.pricing.actualAmount === 'number'
    ? order.pricing.actualAmount
    : 0
  // 优先从已有数据推算历史佣金率，否则读系统配置
  if (currentActual > 0 && currentAmount > 0) {
    const rate = currentAmount / currentActual
    return Math.round(newPrice * rate * 100) / 100
  }
  const rate = await getCommissionRate()
  return Math.round(newPrice * rate * 100) / 100
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''

  const orderId = String(event.orderId || '').trim()
  const newPrice = Number(event.newPrice)
  if (!orderId) return error('订单参数缺失')
  if (!Number.isFinite(newPrice) || newPrice <= 0) return error('请输入有效改价金额')
  if (!openid && !String(event.operatorId || '').trim()) return error('登录状态无效', 'UNAUTHORIZED')

  const user = await getCurrentUser(openid, String(event.operatorId || '').trim())
  if (!user) return error('当前账号未绑定业务用户', 'FORBIDDEN')
  if (!canAdjustPrice(user)) return error('无改价权限', 'FORBIDDEN')

  const order = await getOrder(orderId)
  if (!order) return error('订单不存在', 'NOT_FOUND')
  if (order.status !== 'pending_payment') return error('仅待支付订单可改价', 'INVALID_STATUS')

  const currentPrice = order.pricing && typeof order.pricing.actualAmount === 'number'
    ? order.pricing.actualAmount
    : 0
  if (currentPrice <= 0) return error('订单金额异常')
  if (newPrice >= currentPrice) return error('改价只能低于原价')

  const now = formatDateTime(new Date())
  const operatorName = getOperatorName(user, String(event.operatorName || '').trim())
  const priceLogEntry = {
    originalPrice: currentPrice,
    modifiedPrice: Math.round(newPrice * 100) / 100,
    operatorId: user._id,
    operatorName,
    operatedAt: now,
  }

  const newCommission = await calcCommission(order, priceLogEntry.modifiedPrice)

  await db.collection('orders').doc(order._id).update({
    data: {
      'pricing.actualAmount': priceLogEntry.modifiedPrice,
      'pricing.priceLog': _.push(priceLogEntry),
      'commission.amount': newCommission,
      'payment.adjustedAt': now,
      updatedAt: now,
    },
  })

  // 同步提成记录金额
  try {
    const { data: records } = await db.collection('commission_records').where({
      orderId: order._id,
      sourceType: 'order',
    }).get()
    for (const rec of (records || [])) {
      await db.collection('commission_records').doc(rec._id).update({
        data: { amount: newCommission, updatedAt: now },
      })
    }
    // 写一条改价调整记录
    if (records && records.length > 0 && order.salespersonId) {
      const diff = newCommission - (order.commission && order.commission.amount || 0)
      if (diff !== 0) {
        const { data: salesperson } = await db.collection('users').doc(order.salespersonId).get()
        await db.collection('commission_records').add({
          data: {
            salespersonId: order.salespersonId,
            salespersonOpenid: salesperson?._openid || salesperson?.boundOpenid || '',
            customerId: order.customerId || '',
            orderId: order._id,
            orderNo: order.orderNo || '',
            amount: Math.abs(diff),
            status: diff > 0 ? 'pending' : 'deducted',
            sourceType: 'price_modification',
            description: `改价调整：佣金 ${diff > 0 ? '+' : '-'}¥${Math.abs(diff).toFixed(2)}（¥${currentPrice}→¥${priceLogEntry.modifiedPrice}）`,
            createdAt: now,
            updatedAt: now,
          },
        })
      }
    }
  } catch (_e) { /* non-critical */ }

  await db.collection('logs').add({
    data: {
      operatorId: user._id,
      operatorName,
      operatorRole: user.role,
      action: '订单改价',
      target: order._id,
      detail: `将订单金额从 ¥${currentPrice} 修改为 ¥${priceLogEntry.modifiedPrice}`,
      result: 'success',
      createdAt: now,
    },
  })

  const updated = await getOrder(order._id)
  return { success: true, order: { ...updated, id: updated._id } }
}
