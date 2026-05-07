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

async function getCurrentUser(openid, userId) {
  if (userId) {
    try {
      const { data: user } = await db.collection('users').doc(userId).get()
      if (!user) return null
      if (user._openid && user._openid !== openid) return null
      if (user.boundOpenid && user.boundOpenid !== openid) return null
      if (!user._openid && !user.boundOpenid) {
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

  const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
  if (data && data.length) return data[0]
  const { data: boundUsers } = await db.collection('users').where({ boundOpenid: openid }).limit(1).get()
  return boundUsers && boundUsers.length ? boundUsers[0] : null
}

function cleanInfo(info) {
  return {
    companyName: String(info.companyName || '').trim(),
    realName: String(info.realName || '').trim(),
    idNumber: String(info.idNumber || '').trim(),
    contactName: String(info.contactName || '').trim(),
    contactPhone: String(info.contactPhone || '').trim(),
    region: String(info.region || '').trim(),
    address: String(info.address || '').trim(),
    businessArea: String(info.businessArea || '').trim(),
    experience: String(info.experience || '').trim(),
    channelType: String(info.channelType || 'clinic').trim(),
    expectedMonthlySales: String(info.expectedMonthlySales || '').trim(),
    remark: String(info.remark || '').trim(),
  }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return error('登录状态无效', 'UNAUTHORIZED')

  const user = await getCurrentUser(openid, String(event.userId || '').trim())
  if (!user) return error('当前账号未绑定用户', 'FORBIDDEN')
  if (user.role && !['customer', 'salesperson'].includes(user.role)) return error('当前角色不可申请代理商', 'FORBIDDEN')
  if (user.agentStatus === 'approved' || user.role === 'salesperson') return error('代理商资格已通过，无需重复申请', 'ALREADY_APPROVED')

  const info = cleanInfo(event.info || {})
  if (!info.companyName) return error('请输入公司或机构名称')
  if (!info.realName) return error('请输入姓名')
  if (!info.idNumber) return error('请输入身份证号')
  if (!info.contactName) return error('请输入联系人姓名')
  if (!/^1\d{10}$/.test(info.contactPhone)) return error('请输入正确联系电话')
  if (!info.region || !info.businessArea) return error('请填写代理区域和业务覆盖')

  const now = formatDateTime(new Date())
  const agentApplication = {
    ...info,
    status: 'pending_review',
    submittedAt: now,
    reviewedAt: '',
    rejectReason: '',
  }

  await db.collection('users').doc(user._id).update({
    data: {
      agentStatus: 'pending_review',
      agentApplication,
      updatedAt: now,
    },
  })

  await db.collection('logs').add({
    data: {
      operatorId: user._id,
      operatorName: user.nickname || user.realName || user.phone || info.contactName,
      operatorRole: user.role || 'customer',
      action: '提交代理商申请',
      target: user._id,
      detail: `${info.companyName} 提交代理商申请`,
      result: 'success',
      createdAt: now,
    },
  })

  const { data: updated } = await db.collection('users').doc(user._id).get()
  return { success: true, user: normalize(updated) }
}
