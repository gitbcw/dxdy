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

function getStatusText(status) {
  const map = {
    pending_payment: '待付款',
    pending_shipment: '待发货',
    pending_receipt: '待收货',
    completed: '已完成',
    cancelled: '已取消',
    pending_confirmation: '待确认',
    confirmed: '已确认',
    in_service: '服务中',
  }
  return map[status] || status
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
    await db.collection('users').doc(user._id).update({
      data: { boundOpenid: openid, updatedAt: formatDateTime(new Date()) },
    })
    return { ...user, boundOpenid: openid }
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

function isOwner(order, openid, user) {
  if (order.customerOpenid) return order.customerOpenid === openid
  if (order._openid) return order._openid === openid
  return user && order.customerId === user._id
}

function isStaff(user) {
  return ['admin', 'system_admin', 'service'].includes(user && user.role)
}

function canTransition(order, status, user, openid) {
  if (isOwner(order, openid, user)) {
    if (status === 'cancelled') return order.status === 'pending_payment'
    if (status === 'completed') return order.status === 'pending_receipt'
  }

  if (!isStaff(user)) return false
  const allowed = {
    pending_payment: ['cancelled'],
    pending_confirmation: ['confirmed', 'cancelled'],
    confirmed: ['in_service', 'cancelled'],
    in_service: ['completed', 'cancelled'],
    pending_shipment: ['cancelled'],
    pending_receipt: ['completed'],
  }
  return (allowed[order.status] || []).includes(status)
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''

  const orderId = String(event.orderId || '').trim()
  const status = String(event.status || '').trim()
  if (!orderId) return error('订单参数缺失')
  if (!status) return error('状态参数缺失')
  if (!openid && !String(event.operatorId || '').trim()) return error('登录状态无效', 'UNAUTHORIZED')

  const user = await getCurrentUser(openid, String(event.operatorId || '').trim())
  if (!user) return error('当前账号未绑定业务用户', 'FORBIDDEN')

  const order = await getOrder(orderId)
  if (!order) return error('订单不存在', 'NOT_FOUND')
  if (!canTransition(order, status, user, openid)) return error('当前订单状态不可执行该操作', 'INVALID_STATUS')

  const now = formatDateTime(new Date())
  const updateData = { status, updatedAt: now }
  if (status === 'completed') updateData.completedAt = now
  if (status === 'completed' && order.commission) {
    updateData['commission.status'] = 'settled'
    updateData['commission.settledAt'] = now
  }

  await db.collection('orders').doc(order._id).update({ data: updateData })

  // 订单完成时结算提成入账
  if (status === 'completed' && order.salespersonId && order.commission && order.commission.amount > 0) {
    try {
      const commissionAmount = order.commission.amount
      // 更新提成记录状态为 settled
      const { data: lockedRecords } = await db.collection('commission_records').where({
        orderId: order._id,
        status: 'locked',
      }).get()
      for (const rec of (lockedRecords || [])) {
        await db.collection('commission_records').doc(rec._id).update({
          data: { status: 'settled', settledAt: now, updatedAt: now },
        })
      }
      // 入账代理商余额
      await db.collection('users').doc(order.salespersonId).update({
        data: {
          'commission.total': db.command.inc(commissionAmount),
          'commission.available': db.command.inc(commissionAmount),
          updatedAt: now,
        },
      })
    } catch (_e) { /* non-critical */ }
  }

  // 卡券兑换订单完成 → 标记卡券已核销
  if (status === 'completed' && order.type === 'card_redemption' && order.cardVoucherId) {
    try {
      await db.collection('card_vouchers').doc(order.cardVoucherId).update({
        data: { status: 'verified', verifiedAt: now, updatedAt: now },
      })
    } catch (_e) { /* non-critical */ }
  }

  const operatorName = String(event.operatorName || '').trim() || user.realName || user.nickname || user.name || user.username || '用户'
  await db.collection('logs').add({
    data: {
      operatorId: user._id,
      operatorName,
      operatorRole: user.role,
      action: getStatusText(status),
      target: order._id,
      detail: `订单状态从「${getStatusText(order.status)}」变更为「${getStatusText(status)}」`,
      result: 'success',
      createdAt: now,
    },
  })

  const updated = await getOrder(order._id)
  return { success: true, order: { ...updated, id: updated._id } }
}
