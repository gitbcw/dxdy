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

function canReviewVerification(user) {
  if (!user) return false
  if (['admin', 'system_admin'].includes(user.role)) return true
  if (user.role !== 'service') return false
  return user.permissions && (user.permissions.verification_review === true || user.permissions.manage_users === true)
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

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''

  const userId = String(event.userId || event.customerId || '').trim()
  if (!userId) return error('用户参数缺失')
  if (typeof event.approved !== 'boolean') return error('审核结果参数缺失')
  if (!openid && !String(event.operatorId || event.reviewerId || '').trim()) return error('登录状态无效', 'UNAUTHORIZED')

  const operator = await getCurrentUser(openid, String(event.operatorId || event.reviewerId || '').trim())
  if (!canReviewVerification(operator)) return error('无认证审核权限', 'FORBIDDEN')

  const target = await getUser(userId)
  if (!target) return error('用户不存在', 'NOT_FOUND')
  if (target.role !== 'customer') return error('仅支持医院客户认证审核', 'FORBIDDEN')
  if (target.verificationStatus !== 'pending') return error('当前认证状态不可审核', 'INVALID_STATUS')

  const info = target.verificationInfo || {}
  if (!info.businessLicense) return error('认证材料缺失')
  if (event.approved !== true && !String(event.rejectReason || event.note || '').trim()) return error('请填写驳回原因')

  const now = formatDateTime(new Date())
  const rejectReason = event.approved ? '' : String(event.rejectReason || event.note || '').trim()
  const operatorName = getOperatorName(operator, String(event.operatorName || '').trim())
  const updateData = {
    verificationStatus: event.approved ? 'approved' : 'rejected',
    customerType: event.approved ? 'institution' : (target.customerType || 'personal'),
    'verificationInfo.reviewedAt': now,
    'verificationInfo.reviewerId': operator._id,
    'verificationInfo.reviewerName': operatorName,
    'verificationInfo.rejectReason': rejectReason,
    updatedAt: now,
  }

  await db.collection('users').doc(target._id).update({ data: updateData })

  await db.collection('logs').add({
    data: {
      operatorId: operator._id,
      operatorName,
      operatorRole: operator.role,
      action: event.approved ? '医院认证通过' : '医院认证驳回',
      target: target._id,
      detail: event.approved
        ? `审核通过医院「${info.hospitalName || target.nickname || target.phone}」认证`
        : `驳回医院「${info.hospitalName || target.nickname || target.phone}」认证，原因：${rejectReason}`,
      result: 'success',
      createdAt: now,
    },
  })

  const updated = await getUser(target._id)
  return { success: true, user: normalize(updated) }
}
