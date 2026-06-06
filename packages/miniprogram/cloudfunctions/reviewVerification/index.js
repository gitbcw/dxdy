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
  if (!['customer', 'salesperson'].includes(target.role)) return error('仅支持医院客户和代理商认证审核', 'FORBIDDEN')
  if (target.verificationStatus !== 'pending') return error('当前认证状态不可审核', 'INVALID_STATUS')

  const info = target.verificationInfo || {}
  if (target.role === 'customer' && !info.businessLicense) return error('认证材料缺失')
  if (target.role === 'salesperson' && !info.realName && !info.idCard) return error('认证材料缺失')
  if (event.approved !== true && !String(event.rejectReason || event.note || '').trim()) return error('请填写驳回原因')

  // 审核通过前检查资质编号唯一性
  if (target.role === 'customer' && event.approved && info.businessLicense) {
    const _ = db.command
    const { data: dupes } = await db.collection('users').where({
      'verificationInfo.businessLicense': info.businessLicense,
      verificationStatus: 'approved',
      _id: _.neq(target._id),
    }).limit(1).get()
    if (dupes && dupes.length > 0) {
      return error('该资质编号已被其他机构认证，请核实后重试')
    }
  }

  const now = formatDateTime(new Date())
  const rejectReason = event.approved ? '' : String(event.rejectReason || event.note || '').trim()
  const operatorName = getOperatorName(operator, String(event.operatorName || '').trim())
  const updateData = {
    verificationStatus: event.approved ? 'approved' : 'rejected',
    'verificationInfo.reviewedAt': now,
    'verificationInfo.reviewerId': operator._id,
    'verificationInfo.reviewerName': operatorName,
    'verificationInfo.rejectReason': rejectReason,
    updatedAt: now,
  }
  if (target.role === 'customer') {
    updateData.customerType = event.approved ? 'institution' : (target.customerType || 'personal')
  }

  await db.collection('users').doc(target._id).update({ data: updateData })

  const subjectType = target.role === 'salesperson' ? '代理商' : '医院'
  const subjectName = target.role === 'salesperson'
    ? (info.realName || target.nickname || target.phone)
    : (info.hospitalName || target.nickname || target.phone)

  await db.collection('logs').add({
    data: {
      operatorId: operator._id,
      operatorName,
      operatorRole: operator.role,
      action: event.approved ? `${subjectType}认证通过` : `${subjectType}认证驳回`,
      target: target._id,
      detail: event.approved
        ? `审核通过${subjectType}「${subjectName}」认证`
        : `驳回${subjectType}「${subjectName}」认证，原因：${rejectReason}`,
      result: 'success',
      createdAt: formatBeijingLogTime(),
    },
  })

  const updated = await getUser(target._id)
  return { success: true, user: normalize(updated) }
}
