const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

function normalize(doc) {
  if (!doc) return doc
  const { _id, ...rest } = doc
  return { id: _id, ...rest }
}

function error(message, code = 'BAD_REQUEST') {
  return { success: false, code, error: message }
}

async function getCurrentUser(openid, operatorId) {
  if (openid) {
    const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
    if (data && data.length) return data[0]

    const { data: boundUsers } = await db.collection('users').where({ boundOpenid: openid }).limit(1).get()
    if (boundUsers && boundUsers.length) return boundUsers[0]
  }

  if (operatorId) {
    try {
      const { data } = await db.collection('users').doc(operatorId).get()
      if (data) return data
    } catch (e) {
      return null
    }
  }

  return null
}

function canReadAllOrders(user) {
  if (!user || user.status === 'disabled') return false
  if (['admin', 'system_admin'].includes(user.role)) return true
  if (user.permissions && user.permissions.manage_orders === true) return true
  return user.role === 'service'
}

function canReadOrder(user, order) {
  if (!user || !order) return false
  if (canReadAllOrders(user)) return true
  if (order.customerId === user._id || order.customerOpenid === user._openid || order.customerOpenid === user.boundOpenid) return true
  if (user.role === 'salesperson' && order.salespersonId === user._id) return true
  if (user.role === 'clerk' && (!order.clerkId || order.clerkId === user._id)) return true
  return false
}

function isTerminalOrder(order) {
  return ['completed', 'cancelled'].includes(order && order.status)
}

function isHiddenForUser(order, user) {
  if (!order || !user || canReadAllOrders(user)) return false
  const hiddenBy = Array.isArray(order.hiddenByUserIds) ? order.hiddenByUserIds : []
  return hiddenBy.includes(user._id)
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''
  const operatorId = String(event.operatorId || '').trim()
  if (!openid && !operatorId) return error('Missing login identity', 'UNAUTHORIZED')

  const user = await getCurrentUser(openid, operatorId)
  if (!user) return error('User not found', 'FORBIDDEN')

  const action = String(event.action || 'listOrders')

  if (action === 'listClerks') {
    if (!canReadAllOrders(user)) return error('No permission to read clerks', 'FORBIDDEN')
    const { data } = await db.collection('users').where({ role: 'clerk' }).limit(100).get()
    return { success: true, clerks: (data || []).map(normalize) }
  }

  if (action === 'getOrderById') {
    const orderId = String(event.orderId || '').trim()
    if (!orderId) return error('Missing order ID')
    try {
      const { data: order } = await db.collection('orders').doc(orderId).get()
      if (!canReadOrder(user, order)) return error('No permission to read this order', 'FORBIDDEN')
      if (isHiddenForUser(order, user)) return error('Order not found', 'NOT_FOUND')
      return { success: true, order: normalize(order) }
    } catch (e) {
      return error('Order not found', 'NOT_FOUND')
    }
  }

  if (action === 'getOrderByNo') {
    const orderNo = String(event.orderNo || '').trim()
    if (!orderNo) return error('Missing order number')
    const { data } = await db.collection('orders').where({ orderNo }).limit(1).get()
    const order = data && data[0]
    if (!order) return error('Order not found', 'NOT_FOUND')
    if (!canReadOrder(user, order)) return error('No permission to read this order', 'FORBIDDEN')
    if (isHiddenForUser(order, user)) return error('Order not found', 'NOT_FOUND')
    return { success: true, order: normalize(order) }
  }

  if (action === 'deleteOrder') {
    const orderId = String(event.orderId || '').trim()
    if (!orderId) return error('Missing order ID')

    let order
    try {
      const res = await db.collection('orders').doc(orderId).get()
      order = res.data
    } catch (e) {
      return error('Order not found', 'NOT_FOUND')
    }

    if (!canReadOrder(user, order)) return error('No permission to delete this order', 'FORBIDDEN')
    if (!isTerminalOrder(order)) return error('Only completed or cancelled orders can be deleted', 'INVALID_STATUS')
    if (isHiddenForUser(order, user)) return { success: true, orderId, deleted: true }

    const _ = db.command
    const now = new Date().toISOString()
    await db.collection('orders').doc(orderId).update({
      data: {
        hiddenByUserIds: _.addToSet(user._id),
        hiddenAtByUser: {
          [user._id]: now,
        },
        updatedAt: now,
      },
    })

    return { success: true, orderId, deleted: true }
  }

  if (action !== 'listOrders') return error('Invalid action')

  const cond = {}
  if (canReadAllOrders(user)) {
    if (event.customerId) cond.customerId = String(event.customerId)
  } else if (user.role === 'customer') {
    cond.customerId = user._id
  } else if (user.role === 'salesperson') {
    cond.salespersonId = user._id
    if (event.customerId) cond.customerId = String(event.customerId)
  } else if (user.role === 'clerk') {
    if (event.clerkId) cond.clerkId = String(event.clerkId)
  }

  if (event.status) cond.status = String(event.status)

  const { data } = await db.collection('orders').where(cond).orderBy('createdAt', 'desc').limit(500).get()
  const orders = (data || [])
    .filter(order => canReadOrder(user, order) && !isHiddenForUser(order, user))
    .map(normalize)
  return { success: true, orders }
}
