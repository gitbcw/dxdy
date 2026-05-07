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

function canReview(user) {
  if (!user) return false
  if (['admin', 'system_admin'].includes(user.role)) return true
  if (user.role !== 'service') return false
  return !user.permissions || user.permissions.return_review === true || user.permissions.manage_returns === true
}

async function getReturnRecord(id) {
  if (!id) return null
  try {
    const { data } = await db.collection('returns').doc(id).get()
    return data || null
  } catch (e) {
    return null
  }
}

function canonicalStatus(status) {
  const map = {
    pending_return_ship: 'customer_shipping',
    returned: 'received',
    verifying: 'received',
  }
  return map[status] || status
}

function getTargetStatus(event) {
  if (event.status) return canonicalStatus(String(event.status).trim())
  if (typeof event.approved === 'boolean') return event.approved ? 'approved' : 'rejected'
  return ''
}

function getAllowedStatuses(record) {
  const current = canonicalStatus(record.status)
  const base = {
    pending_review: ['approved', 'rejected'],
    approved: record.type === 'refund_only' ? ['refunding'] : ['customer_shipping', 'refunding'],
    customer_shipping: ['received'],
    received: record.type === 'exchange' ? ['exchange_shipping', 'rejected'] : ['refunding', 'rejected'],
    refunding: ['return_completed'],
    exchange_shipping: ['exchange_completed'],
  }
  return base[current] || []
}

function getStatusText(status) {
  const map = {
    pending_review: '商家审核中',
    approved: '审核通过',
    rejected: '审核驳回',
    customer_shipping: '等待客户寄回',
    received: '商品质检',
    refunding: '退款处理中',
    return_completed: '售后完成',
    exchange_shipping: '换货发货中',
    exchange_completed: '换货完成',
  }
  return map[status] || status
}

function getTimelineDesc(status) {
  const map = {
    approved: '售后申请已通过审核',
    rejected: '售后申请未通过审核',
    customer_shipping: '请客户按客服指引寄回商品',
    received: '商家已收到寄回商品，正在质检',
    refunding: '质检通过，退款处理中',
    return_completed: '本次售后已完成',
    exchange_shipping: '换货商品已进入发货流程',
    exchange_completed: '换货流程已完成',
  }
  return map[status] || '售后流程已更新'
}

function getOperatorName(user, fallback) {
  return fallback || user.realName || user.nickname || user.name || user.username || '客服'
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''

  const id = String(event.id || event.returnId || '').trim()
  const targetStatus = getTargetStatus(event)
  if (!id) return error('售后单参数缺失')
  if (!targetStatus) return error('状态参数缺失')
  if (!openid && !String(event.reviewerId || event.operatorId || '').trim()) return error('登录状态无效', 'UNAUTHORIZED')

  const user = await getCurrentUser(openid, String(event.reviewerId || event.operatorId || '').trim())
  if (!canReview(user)) return error('无售后审核权限', 'FORBIDDEN')

  const record = await getReturnRecord(id)
  if (!record) return error('售后记录不存在', 'NOT_FOUND')

  const allowed = getAllowedStatuses(record)
  if (!allowed.includes(targetStatus)) return error('当前售后状态不可执行该操作', 'INVALID_STATUS')

  const now = formatDateTime(new Date())
  const note = String(event.note || event.reviewNote || '').trim()
  const operatorName = getOperatorName(user, String(event.operatorName || '').trim())
  const timelineEntry = {
    status: targetStatus,
    title: getStatusText(targetStatus),
    time: now,
    desc: note || getTimelineDesc(targetStatus),
  }
  const updateData = {
    status: targetStatus,
    updatedAt: now,
    timeline: db.command.push(timelineEntry),
  }

  if (canonicalStatus(record.status) === 'pending_review') {
    updateData.reviewerId = user._id
    updateData.reviewNote = note
    updateData.reviewedAt = now
  }
  if (targetStatus === 'received') updateData.verificationResult = 'pending'
  if (targetStatus === 'refunding' || targetStatus === 'return_completed' || targetStatus === 'exchange_shipping') {
    updateData.verificationResult = 'qualified'
  }
  if (targetStatus === 'rejected' && canonicalStatus(record.status) === 'received') {
    updateData.verificationResult = 'unqualified'
  }

  await db.collection('returns').doc(record._id).update({ data: updateData })

  await db.collection('logs').add({
    data: {
      operatorId: user._id,
      operatorName,
      operatorRole: user.role,
      action: getStatusText(targetStatus),
      target: record._id,
      detail: `售后单 ${record.afterNo || record._id} 从「${getStatusText(canonicalStatus(record.status))}」变更为「${getStatusText(targetStatus)}」${note ? `，备注：${note}` : ''}`,
      result: 'success',
      createdAt: now,
    },
  })

  const updated = await getReturnRecord(record._id)
  return { success: true, record: normalize(updated) }
}
