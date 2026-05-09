const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

function formatDateTime(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
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

async function getUser(id) {
  if (!id) return null
  try {
    const { data } = await db.collection('users').doc(id).get()
    return data || null
  } catch (e) {
    return null
  }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''

  const customerId = String(event.customerId || '').trim()
  const salespersonId = String(event.salespersonId || '').trim()
  if (!customerId || !salespersonId) return error('参数缺失：需要 customerId 和 salespersonId')
  if (!openid && !String(event.operatorId || '').trim()) return error('登录状态无效', 'UNAUTHORIZED')

  const operator = await getCurrentUser(openid, String(event.operatorId || '').trim())
  if (!operator) return error('当前账号未绑定业务用户', 'FORBIDDEN')

  // 权限校验：admin/system_admin/service 或销售员本人
  const isAdmin = ['admin', 'system_admin', 'service'].includes(operator.role)
  const isSelf = operator.role === 'salesperson' && operator._id === salespersonId
  if (!isAdmin && !isSelf) return error('无权操作代理绑定', 'FORBIDDEN')

  const customer = await getUser(customerId)
  if (!customer) return error('客户不存在', 'NOT_FOUND')
  if (customer.role !== 'customer') return error('目标用户不是客户', 'FORBIDDEN')

  const salesperson = await getUser(salespersonId)
  if (!salesperson) return error('代理商/销售员不存在', 'NOT_FOUND')
  if (salesperson.role !== 'salesperson') return error('目标用户不是代理商/销售员', 'FORBIDDEN')

  // 检查当前绑定
  const oldSalespersonId = customer.boundSalespersonId || ''
  if (oldSalespersonId === salespersonId) {
    return error('该客户已绑定此代理商，无需重复操作')
  }

  // 非管理员不允许覆盖已有绑定
  if (oldSalespersonId && !isAdmin) {
    return error('该客户已有绑定代理商，请联系管理员变更')
  }

  const now = formatDateTime(new Date())
  const operatorName = operator.realName || operator.nickname || operator.name || operator.username || '系统'

  // 执行绑定
  await db.collection('users').doc(customerId).update({
    data: { boundSalespersonId: salespersonId, updatedAt: now },
  })
  await db.collection('users').doc(salespersonId).update({
    data: { customers: _.addToSet(customerId), updatedAt: now },
  })

  // 如果旧绑定存在，从旧代理商的 customers 列表中移除
  if (oldSalespersonId && oldSalespersonId !== salespersonId) {
    try {
      await db.collection('users').doc(oldSalespersonId).update({
        data: { customers: _.pull(customerId), updatedAt: now },
      })
    } catch (_e) { /* non-critical */ }
  }

  // 审计日志
  await db.collection('logs').add({
    data: {
      operatorId: operator._id,
      operatorName,
      operatorRole: operator.role,
      action: oldSalespersonId ? '代理绑定变更' : '代理绑定',
      target: customerId,
      detail: oldSalespersonId
        ? `客户代理绑定从 ${oldSalespersonId} 变更为 ${salespersonId}（${salesperson.nickname || salesperson.name || ''}）`
        : `客户绑定代理商 ${salespersonId}（${salesperson.nickname || salesperson.name || ''}）`,
      result: 'success',
      createdAt: now,
    },
  })

  const updated = await getUser(customerId)
  const { _id, _openid, ...rest } = updated
  return { success: true, user: { id: _id, ...rest } }
}
