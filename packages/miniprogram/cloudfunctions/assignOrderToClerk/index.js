const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

function formatBeijingLogTime(date = new Date()) {
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const y = beijing.getUTCFullYear()
  const m = String(beijing.getUTCMonth() + 1).padStart(2, '0')
  const d = String(beijing.getUTCDate()).padStart(2, '0')
  const h = String(beijing.getUTCHours()).padStart(2, '0')
  const min = String(beijing.getUTCMinutes()).padStart(2, '0')
  const s = String(beijing.getUTCSeconds()).padStart(2, '0')
  return y + '-' + m + '-' + d + ' ' + h + ':' + min + ':' + s + '+08:00'
}
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

function normalize(doc) {
  if (!doc) return doc
  const { _id, _openid, ...rest } = doc
  return { id: _id, ...rest }
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

function canAssign(user) {
  if (!user) return false
  if (['admin', 'system_admin'].includes(user.role)) return true
  if (user.role !== 'service') return false
  return !user.permissions || user.permissions.manage_orders === true || user.permissions.order_assign === true
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

async function getClerk(clerkId) {
  if (!clerkId) return null
  try {
    const { data } = await db.collection('users').doc(clerkId).get()
    return data || null
  } catch (e) {
    return null
  }
}

function getOperatorName(user, fallback) {
  return fallback || user.realName || user.nickname || user.name || user.username || '客服'
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''

  const orderId = String(event.orderId || '').trim()
  const clerkId = String(event.clerkId || '').trim()
  if (!orderId) return error('订单参数缺失')
  if (!clerkId) return error('制单员参数缺失')
  if (!openid && !String(event.operatorId || '').trim()) return error('登录状态无效', 'UNAUTHORIZED')

  const user = await getCurrentUser(openid, String(event.operatorId || '').trim())
  if (!canAssign(user)) return error('无订单指派权限', 'FORBIDDEN')

  const order = await getOrder(orderId)
  if (!order) return error('订单不存在', 'NOT_FOUND')
  if (!['pending_shipment', 'confirmed'].includes(order.status)) {
    return error('当前订单状态不可指派制单员', 'INVALID_STATUS')
  }

  const clerk = await getClerk(clerkId)
  if (!clerk || clerk.role !== 'clerk') return error('制单员不存在', 'NOT_FOUND')

  const now = formatDateTime(new Date())
  await db.collection('orders').doc(order._id).update({
    data: {
      clerkId,
      assignedAt: now,
      updatedAt: now,
    },
  })

  await db.collection('users').doc(clerk._id).update({
    data: {
      assignedOrderIds: _.addToSet ? _.addToSet(order._id) : _.push(order._id),
      updatedAt: now,
    },
  })

  const operatorName = getOperatorName(user, String(event.operatorName || '').trim())
  const clerkName = clerk.realName || clerk.nickname || clerk.name || clerk.username || clerk._id
  await db.collection('logs').add({
    data: {
      operatorId: user._id,
      operatorName,
      operatorRole: user.role,
      action: '订单指派制单员',
      target: order._id,
      detail: `将订单 ${order.orderNo || order._id} 指派给制单员「${clerkName}」`,
      result: 'success',
      createdAt: formatBeijingLogTime(),
    },
  })

  const updated = await getOrder(order._id)
  return { success: true, order: normalize(updated) }
}
