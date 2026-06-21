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

function formatBeijingLogTime(date = new Date()) {
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const y = beijing.getUTCFullYear()
  const m = String(beijing.getUTCMonth() + 1).padStart(2, '0')
  const d = String(beijing.getUTCDate()).padStart(2, '0')
  const h = String(beijing.getUTCHours()).padStart(2, '0')
  const min = String(beijing.getUTCMinutes()).padStart(2, '0')
  const s = String(beijing.getUTCSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}:${s}+08:00`
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
  const id = String(userId || '').trim()
  if (id) {
    try {
      const { data } = await db.collection('users').doc(id).get()
      if (!data) return null
      if (data._openid === openid || data.boundOpenid === openid || !data._openid && !data.boundOpenid) {
        return data
      }
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
    businessLicense: String(info.businessLicense || '').trim(),
    sitePhoto: String(info.sitePhoto || '').trim(),
    hospitalName: String(info.hospitalName || '').trim(),
    legalPerson: String(info.legalPerson || '').trim(),
    contactName: String(info.contactName || '').trim(),
    contactPhone: String(info.contactPhone || '').trim(),
    region: String(info.region || '').trim(),
    address: String(info.address || '').trim(),
  }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''
  if (!openid) return error('登录状态无效', 'UNAUTHORIZED')

  const user = await getCurrentUser(openid, event.userId)
  if (!user) return error('当前账号未绑定用户', 'FORBIDDEN')
  if (user.role !== 'customer') return error('仅客户可提交门店认证', 'FORBIDDEN')

  const info = cleanInfo(event.info || {})
  if (!info.businessLicense) return error('请上传营业执照')
  if (!info.hospitalName) return error('请输入门店名称')
  if (!info.contactName) return error('请输入联系人姓名')
  if (!/^1\d{10}$/.test(info.contactPhone)) return error('请输入正确联系电话')

  const now = formatDateTime(new Date())
  const verificationInfo = {
    ...info,
    submittedAt: now,
    reviewedAt: '',
    reviewerId: '',
    reviewerName: '',
    rejectReason: '',
  }

  await db.collection('users').doc(user._id).update({
    data: {
      customerType: 'institution',
      verificationStatus: 'pending',
      verificationInfo,
      updatedAt: now,
    },
  })

  await db.collection('logs').add({
    data: {
      operatorId: user._id,
      operatorName: info.hospitalName || user.nickname || user.phone || info.contactName,
      operatorRole: user.role,
      action: '提交门店认证',
      target: user._id,
      detail: `${info.hospitalName} 提交门店认证申请`,
      result: 'success',
      createdAt: formatBeijingLogTime(),
    },
  })

  const { data: updated } = await db.collection('users').doc(user._id).get()
  return { success: true, user: normalize(updated) }
}
