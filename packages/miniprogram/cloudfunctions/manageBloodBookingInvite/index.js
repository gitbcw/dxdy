const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

function pad(value) {
  return String(value).padStart(2, '0')
}

function getBeijingParts(date = new Date()) {
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  return {
    year: beijing.getUTCFullYear(),
    month: beijing.getUTCMonth() + 1,
    day: beijing.getUTCDate(),
    hours: beijing.getUTCHours(),
    minutes: beijing.getUTCMinutes(),
  }
}

function formatDateTime(date = new Date()) {
  const parts = getBeijingParts(date)
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hours)}:${pad(parts.minutes)}`
}

function getTodayEnd() {
  const { year, month, day } = getBeijingParts()
  return new Date(Date.UTC(year, month - 1, day, 15, 59, 59))
}

function parseBeijingDateTime(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/)
  if (!match) return null
  const [, year, month, day, hours, minutes] = match
  const time = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hours) - 8, Number(minutes), 0)
  return Number.isFinite(time) ? new Date(time) : null
}

function error(message, code = 'BAD_REQUEST') {
  return { success: false, code, error: message }
}

function getInvitePath(inviteId) {
  return `/pages/blood/booking/booking?invite=${encodeURIComponent(inviteId)}`
}

async function getUsersByOpenid(openid) {
  if (!openid) return []
  const [openidRes, boundRes] = await Promise.all([
    db.collection('users').where({ _openid: openid }).limit(1).get(),
    db.collection('users').where({ boundOpenid: openid }).limit(1).get(),
  ])
  const map = new Map()
  for (const item of [...(openidRes.data || []), ...(boundRes.data || [])]) {
    if (item && item._id) map.set(item._id, item)
  }
  return Array.from(map.values())
}

async function getCurrentUser(openid) {
  const users = await getUsersByOpenid(openid)
  return users[0] || null
}

async function getUserById(userId) {
  if (!userId) return null
  try {
    const { data } = await db.collection('users').doc(userId).get()
    return data || null
  } catch (_e) {
    return null
  }
}

async function resolveUser(openid, userId = '') {
  return await getUserById(userId) || await getCurrentUser(openid)
}

async function resolveInstitutionUser(openid, userId = '') {
  const user = await getUserById(userId)
  if (user) return user

  const users = await getUsersByOpenid(openid)
  return users.find((item) => (
    item.role === 'customer' &&
    item.customerType === 'institution' &&
    item.verificationStatus === 'approved'
  )) || users.find((item) => (
    item.role === 'customer' &&
    item.customerType === 'institution'
  )) || users[0] || null
}

async function createInvite(openid, userId = '') {
  const user = await resolveInstitutionUser(openid, userId)
  if (!user || user.role !== 'customer' || user.customerType !== 'institution') {
    return error('仅医院客户可以生成预约二维码', 'FORBIDDEN')
  }
  if (user.verificationStatus !== 'approved') {
    return error('请先完成门店认证后再生成预约二维码', 'FORBIDDEN')
  }

  const expiresAtDate = getTodayEnd()
  const now = new Date()
  const invite = {
    hospitalId: user._id,
    hospitalName: user.nickname || user.realName || user.phone || '医院客户',
    hospitalPhone: user.phone || '',
    status: 'active',
    expiresAt: formatDateTime(expiresAtDate),
    createdAt: formatDateTime(now),
    updatedAt: formatDateTime(now),
  }

  const { _id } = await db.collection('blood_booking_invites').add({ data: invite })
  const path = getInvitePath(_id)
  return { success: true, invite: { ...invite, id: _id, path, qrcodeFileId: '', qrcodeUrl: '' } }
}

async function getInvite(inviteId) {
  if (!inviteId) return error('缺少预约邀请')
  try {
    const { data } = await db.collection('blood_booking_invites').doc(inviteId).get()
    if (!data || data.status !== 'active') return error('预约二维码无效或已失效', 'NOT_FOUND')
    const expiresAt = parseBeijingDateTime(data.expiresAt)
    if (expiresAt && expiresAt.getTime() < Date.now()) {
      return error('预约二维码已过期，请联系医院重新生成', 'EXPIRED')
    }
    return {
      success: true,
      invite: {
        id: data._id,
        hospitalId: data.hospitalId,
        hospitalName: data.hospitalName || '医院客户',
        expiresAt: data.expiresAt,
        path: getInvitePath(data._id),
        qrcodeFileId: data.qrcodeFileId || '',
        qrcodeUrl: data.qrcodeFileId || '',
      },
    }
  } catch (_e) {
    return error('预约二维码无效或已失效', 'NOT_FOUND')
  }
}

async function listCommissions(openid, userId = '') {
  const user = await resolveInstitutionUser(openid, userId)
  if (!user || user.role !== 'customer' || user.customerType !== 'institution') {
    return error('仅医院客户可以查看医院佣金', 'FORBIDDEN')
  }

  const { data } = await db.collection('blood_commission_records').where({
    hospitalId: user._id,
  }).orderBy('createdAt', 'desc').limit(100).get()

  return {
    success: true,
    records: (data || []).map(({ _id, ...record }) => ({ id: _id, ...record })),
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const action = event && event.action

  if (action === 'create') return createInvite(wxContext.OPENID, String(event.userId || '').trim())
  if (action === 'get') return getInvite(String(event.inviteId || ''))
  if (action === 'listCommissions') return listCommissions(wxContext.OPENID, String(event.userId || '').trim())

  return error('不支持的操作')
}
