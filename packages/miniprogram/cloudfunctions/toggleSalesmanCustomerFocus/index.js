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

  const customerId = String(event.customerId || '').trim()
  if (!customerId) return error('客户不存在')

  const { data: customer } = await db.collection('users').doc(customerId).get()
  if (!customer || customer.role !== 'customer') return error('客户不存在')
  if (customer.boundSalespersonId !== user._id) return error('只能关注自己的绑定客户', 'FORBIDDEN')

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
