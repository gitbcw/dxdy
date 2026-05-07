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

function normalize(doc) {
  if (!doc) return doc
  const { _id, _openid, ...rest } = doc
  return { id: _id, ...rest }
}

async function getCurrentUser(openid, operatorId) {
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
    if (['admin', 'system_admin', 'finance', 'service'].includes(user.role)) {
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

function canReviewWithdrawal(user) {
  if (!user) return false
  if (['admin', 'system_admin', 'finance'].includes(user.role)) return true
  if (user.role !== 'service') return false
  return user.permissions && (user.permissions.withdrawal_review === true || user.permissions.manage_finance === true)
}

async function getWithdrawal(id) {
  if (!id) return null
  try {
    const { data } = await db.collection('withdrawals').doc(id).get()
    return data || null
  } catch (e) {
    return null
  }
}

function getTargetStatus(event) {
  if (event.status) {
    const status = String(event.status).trim()
    return status === 'completed' ? 'paid' : status
  }
  if (typeof event.approved === 'boolean') return event.approved ? 'approved' : 'rejected'
  if (event.action === 'pay' || event.action === 'paid') return 'paid'
  return ''
}

function canTransition(current, target) {
  if (current === 'pending_review') return ['approved', 'rejected'].includes(target)
  if (current === 'approved') return target === 'paid'
  return false
}

function getStatusText(status) {
  const map = {
    pending_review: '审核中',
    approved: '提现审核通过',
    rejected: '提现审核驳回',
    paid: '提现已打款',
  }
  return map[status] || status
}

function getOperatorName(user, fallback) {
  return fallback || user.realName || user.nickname || user.name || user.username || '财务'
}

async function refundWithdrawal(record, now) {
  const updateResult = await db.collection('withdrawals').where({
    _id: record._id,
    status: 'pending_review',
  }).update({
    data: {
      status: 'rejected',
      reviewedAt: now,
      updatedAt: now,
    },
  })
  if (!updateResult.stats || updateResult.stats.updated < 1) return false

  await db.collection('users').doc(record.salespersonId).update({
    data: {
      'commission.available': _.inc(record.amount),
      'commission.withdrawn': _.inc(-record.amount),
      updatedAt: now,
    },
  })
  return true
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''

  const id = String(event.id || event.withdrawalId || '').trim()
  const targetStatus = getTargetStatus(event)
  if (!id) return error('提现记录参数缺失')
  if (!targetStatus) return error('状态参数缺失')
  if (!openid && !String(event.reviewerId || event.operatorId || '').trim()) return error('登录状态无效', 'UNAUTHORIZED')

  const user = await getCurrentUser(openid, String(event.reviewerId || event.operatorId || '').trim())
  if (!canReviewWithdrawal(user)) return error('无提现审核权限', 'FORBIDDEN')

  const record = await getWithdrawal(id)
  if (!record) return error('提现记录不存在', 'NOT_FOUND')
  if (!canTransition(record.status, targetStatus)) return error('当前提现状态不可执行该操作', 'INVALID_STATUS')

  const now = formatDateTime(new Date())
  const note = String(event.note || event.reviewNote || '').trim()
  const operatorName = getOperatorName(user, String(event.operatorName || '').trim())
  const updateData = {
    status: targetStatus,
    reviewerId: user._id,
    reviewNote: note,
    updatedAt: now,
  }

  if (targetStatus === 'approved' || targetStatus === 'rejected') updateData.reviewedAt = now
  if (targetStatus === 'paid') updateData.completedAt = now

  if (targetStatus === 'rejected') {
    const refunded = await refundWithdrawal(record, now)
    if (!refunded) return error('提现状态已变化，请刷新后重试', 'INVALID_STATUS')
    await db.collection('withdrawals').doc(record._id).update({
      data: { reviewerId: user._id, reviewNote: note, updatedAt: now },
    })
  } else {
    await db.collection('withdrawals').doc(record._id).update({ data: updateData })
  }

  await db.collection('logs').add({
    data: {
      operatorId: user._id,
      operatorName,
      operatorRole: user.role,
      action: getStatusText(targetStatus),
      target: record._id,
      detail: `代理商 ${record.salespersonId} 提现 ¥${record.amount} 变更为「${getStatusText(targetStatus)}」${note ? `，备注：${note}` : ''}`,
      result: 'success',
      createdAt: now,
    },
  })

  const updated = await getWithdrawal(record._id)
  return { success: true, record: normalize(updated) }
}
