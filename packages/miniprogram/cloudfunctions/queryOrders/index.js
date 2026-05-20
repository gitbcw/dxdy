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

async function getCurrentUser(openid) {
  if (!openid) return null

  const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
  if (data && data.length) return data[0]

  const { data: boundUsers } = await db.collection('users').where({ boundOpenid: openid }).limit(1).get()
  if (boundUsers && boundUsers.length) return boundUsers[0]

  return null
}

function canReadOrder(user, order) {
  if (!user || !order) return false
  if (['admin', 'system_admin', 'service', 'product_manager'].includes(user.role)) return true
  if (order.customerId === user._id || order.customerOpenid === user._openid || order.customerOpenid === user.boundOpenid) return true
  if (user.role === 'salesperson' && order.salespersonId === user._id) return true
  if (user.role === 'clerk' && (!order.clerkId || order.clerkId === user._id)) return true
  return false
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return error('登录状态无效', 'UNAUTHORIZED')

  const user = await getCurrentUser(openid)
  if (!user) return error('用户不存在', 'FORBIDDEN')

  const action = String(event.action || 'listOrders')

  if (action === 'getOrderById') {
    const orderId = String(event.orderId || '').trim()
    if (!orderId) return error('缺少订单 ID')
    try {
      const { data: order } = await db.collection('orders').doc(orderId).get()
      if (!canReadOrder(user, order)) return error('无权查看该订单', 'FORBIDDEN')
      return { success: true, order: normalize(order) }
    } catch (e) {
      return error('订单不存在', 'NOT_FOUND')
    }
  }

  if (action === 'getOrderByNo') {
    const orderNo = String(event.orderNo || '').trim()
    if (!orderNo) return error('缺少订单号')
    const { data } = await db.collection('orders').where({ orderNo }).limit(1).get()
    const order = data && data[0]
    if (!order) return error('订单不存在', 'NOT_FOUND')
    if (!canReadOrder(user, order)) return error('无权查看该订单', 'FORBIDDEN')
    return { success: true, order: normalize(order) }
  }

  if (action !== 'listOrders') return error('无效操作')

  const cond = {}
  if (user.role === 'customer') {
    cond.customerId = user._id
  } else if (user.role === 'salesperson') {
    cond.salespersonId = user._id
    if (event.customerId) cond.customerId = String(event.customerId)
  } else if (user.role === 'clerk') {
    if (event.clerkId) cond.clerkId = String(event.clerkId)
  } else if (event.customerId) {
    cond.customerId = String(event.customerId)
  }

  if (event.status) cond.status = String(event.status)

  const { data } = await db.collection('orders').where(cond).orderBy('createdAt', 'desc').limit(100).get()
  const orders = (data || []).filter(order => canReadOrder(user, order)).map(normalize)
  return { success: true, orders }
}
