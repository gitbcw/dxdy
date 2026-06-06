const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

function normalize(doc) {
  if (!doc) return doc
  const { _id, _openid, ...rest } = doc
  return { id: _id, ...rest }
}

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

async function getCurrentUser(openid, userId) {
  if (userId) {
    try {
      const { data: user } = await db.collection('users').doc(userId).get()
      if (!user) return null
      if (user._openid && user._openid !== openid) return null
      if (user.boundOpenid && user.boundOpenid !== openid) return null
      return user
    } catch (e) {
      return null
    }
  }

  const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
  if (data && data.length) return data[0]
  const { data: boundUsers } = await db.collection('users').where({ boundOpenid: openid }).limit(1).get()
  return boundUsers && boundUsers.length ? boundUsers[0] : null
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return error('登录状态无效', 'UNAUTHORIZED')

  const user = await getCurrentUser(openid, String(event.userId || '').trim())
  if (!user) return error('当前账号未绑定用户', 'FORBIDDEN')
  if (user.role !== 'salesperson' && user.role !== 'agent') return error('当前账号不是代理商', 'FORBIDDEN')

  const focusCol = db.collection('salesperson_customer_focus')
  const action = String(event.action || 'toggle')
  if (action === 'list') {
    try {
      const { data } = await focusCol.where({ salespersonId: user._id }).limit(100).get()
      return { success: true, focusRecords: data || [] }
    } catch (e) {
      return { success: true, focusRecords: [] }
    }
  }

  if (action === 'customers') {
    const [{ data: customerDocs }, { data: orderDocs }, { data: returnDocs }, focusResult] = await Promise.all([
      db.collection('users').where({ role: 'customer', boundSalespersonId: user._id }).limit(100).get(),
      db.collection('orders').where({ salespersonId: user._id }).orderBy('createdAt', 'desc').limit(100).get(),
      db.collection('returns').limit(100).get(),
      focusCol.where({ salespersonId: user._id }).limit(100).get().catch(() => ({ data: [] })),
    ])
    const orders = (orderDocs || []).map(normalize)
    const returns = (returnDocs || []).map(normalize)
    const focusMap = new Map((focusResult.data || []).map((item) => [item.customerId, item]))
    const monthKey = formatDate(new Date()).slice(0, 7)
    const customers = (customerDocs || []).map((doc) => {
      const customer = normalize(doc)
      const customerOrders = orders.filter((order) => order.customerId === customer.id)
      const customerReturns = returns.filter((record) => customerOrders.some((order) => order.id === record.orderId))
      const totalAmount = customerOrders.reduce((sum, order) => sum + ((order.pricing && order.pricing.actualAmount) || 0), 0)
      const monthAmount = customerOrders
        .filter((order) => String(order.createdAt || '').slice(0, 7) === monthKey)
        .reduce((sum, order) => sum + ((order.pricing && order.pricing.actualAmount) || 0), 0)
      const lastOrder = customerOrders[0] || null
      const focusRecord = focusMap.get(customer.id)
      return {
        ...customer,
        type: customer.customerType || 'personal',
        totalAmount,
        monthAmount,
        orderCount: customerOrders.length,
        exchangeCount: customerReturns.length,
        lastOrderAt: lastOrder ? lastOrder.createdAt || '' : '',
        lastOrderNo: lastOrder ? lastOrder.orderNo || '' : '',
        lastOrderStatus: lastOrder ? lastOrder.status || '' : '',
        boundAt: customer.boundAt || customer.createdAt || '',
        isFocused: Boolean(focusRecord),
        focusCreatedAt: focusRecord ? focusRecord.createdAt || '' : '',
      }
    })
    return { success: true, customers }
  }

  const customerId = String(event.customerId || '').trim()
  if (!customerId) return error('客户不存在')

  const { data: customer } = await db.collection('users').doc(customerId).get()
  if (!customer || customer.role !== 'customer') return error('客户不存在')
  if (customer.boundSalespersonId !== user._id) return error('只能关注自己的绑定客户', 'FORBIDDEN')

  if (action === 'detail') {
    const [{ data: orderDocs }, { data: returnDocs }, { data: commissionDocs }] = await Promise.all([
      db.collection('orders').where({ customerId, salespersonId: user._id }).orderBy('createdAt', 'desc').limit(100).get(),
      db.collection('returns').where({ customerId }).orderBy('createdAt', 'desc').limit(100).get(),
      db.collection('commission_records').where({ customerId, salespersonId: user._id }).orderBy('createdAt', 'desc').limit(100).get(),
    ])
    const orders = (orderDocs || []).map(normalize)
    const returns = (returnDocs || []).map(normalize)
    const commissions = (commissionDocs || []).map(normalize)
    const monthKey = formatDate(new Date()).slice(0, 7)
    const totalAmount = orders.reduce((sum, order) => sum + ((order.pricing && order.pricing.actualAmount) || 0), 0)
    const monthAmount = orders
      .filter((order) => String(order.createdAt || '').slice(0, 7) === monthKey)
      .reduce((sum, order) => sum + ((order.pricing && order.pricing.actualAmount) || 0), 0)
    const commissionAmount = commissions.reduce((sum, record) => sum + (record.amount || 0), 0)

    return {
      success: true,
      detail: {
        customer: {
          ...normalize(customer),
          type: customer.customerType || 'personal',
          boundAt: customer.boundAt || customer.createdAt || '',
        },
        orders,
        returns,
        commissions,
        stats: {
          orderCount: orders.length,
          totalAmount,
          monthAmount,
          commissionAmount,
          afterSaleCount: returns.length,
        },
      },
    }
  }

  const { data } = await focusCol.where({ salespersonId: user._id, customerId }).limit(1).get()
  const existing = data && data[0]

  if (existing && existing._id) {
    await focusCol.doc(existing._id).remove()
    return { success: true, focused: false }
  }

  const now = formatDateTime(new Date())
  const { _id } = await focusCol.add({
    data: {
      salespersonId: user._id,
      customerId,
      createdAt: now,
      updatedAt: now,
    },
  })

  return { success: true, focused: true, id: _id }
}
