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

function canReviewAgent(user) {
  if (!user) return false
  if (['admin', 'system_admin'].includes(user.role)) return true
  if (user.role !== 'service') return false
  return user.permissions && (user.permissions.agent_review === true || user.permissions.salesperson_manage === true || user.permissions.manage_users === true)
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

function getOperatorName(user, fallback) {
  return fallback || user.realName || user.nickname || user.name || user.username || '客服'
}

function getApplicationName(user) {
  const app = user.agentApplication || {}
  return app.companyName || app.contactName || user.nickname || user.phone || user._id
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''

  const userId = String(event.userId || event.agentId || '').trim()
  if (!userId) return error('用户参数缺失')
  if (typeof event.approved !== 'boolean') return error('审核结果参数缺失')
  if (!openid && !String(event.operatorId || event.reviewerId || '').trim()) return error('登录状态无效', 'UNAUTHORIZED')

  const operator = await getCurrentUser(openid, String(event.operatorId || event.reviewerId || '').trim())
  if (!canReviewAgent(operator)) return error('无代理商审核权限', 'FORBIDDEN')

  const target = await getUser(userId)
  if (!target) return error('用户不存在', 'NOT_FOUND')
  if (!['customer', 'salesperson'].includes(target.role)) return error('当前角色不可审核代理商申请', 'FORBIDDEN')
  if (target.role === 'salesperson' || target.agentStatus === 'approved') return error('代理商资格已开通', 'ALREADY_APPROVED')
  if (target.agentStatus !== 'pending_review' || !target.agentApplication) return error('当前没有待审核代理商申请', 'INVALID_STATUS')

  const now = formatDateTime(new Date())
  const note = String(event.rejectReason || event.note || '').trim()
  if (event.approved !== true && !note) return error('请填写驳回原因')

  const operatorName = getOperatorName(operator, String(event.operatorName || '').trim())
  const updateData = {
    agentStatus: event.approved ? 'approved' : 'rejected',
    'agentApplication.status': event.approved ? 'approved' : 'rejected',
    'agentApplication.reviewedAt': now,
    'agentApplication.reviewerId': operator._id,
    'agentApplication.reviewerName': operatorName,
    'agentApplication.rejectReason': event.approved ? '' : note,
    updatedAt: now,
  }

  if (event.approved) {
    updateData.role = 'salesperson'
    updateData.verificationStatus = target.verificationStatus || 'approved'
    updateData.commission = target.commission || {
      total: 0,
      available: 0,
      withdrawn: 0,
      pendingDeduction: 0,
    }
    updateData.bankCards = Array.isArray(target.bankCards) ? target.bankCards : []
    updateData.customers = Array.isArray(target.customers) ? target.customers : []
    updateData.agentApprovedAt = now
  }

  await db.collection('users').doc(target._id).update({ data: updateData })

  await db.collection('logs').add({
    data: {
      operatorId: operator._id,
      operatorName,
      operatorRole: operator.role,
      action: event.approved ? '代理商审核通过' : '代理商审核驳回',
      target: target._id,
      detail: event.approved
        ? `审核通过「${getApplicationName(target)}」代理商申请`
        : `驳回「${getApplicationName(target)}」代理商申请，原因：${note}`,
      result: 'success',
      createdAt: formatBeijingLogTime(),
    },
  })

  const updated = await getUser(target._id)
  return { success: true, user: normalize(updated) }
}
