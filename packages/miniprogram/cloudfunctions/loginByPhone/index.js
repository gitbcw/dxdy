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

function normalize(doc) {
  if (!doc) return doc
  const { _id, _openid, ...rest } = doc
  return { id: _id, ...rest }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return { success: false, error: '登录状态无效' }

  const phone = String(event.phone || '').trim()
  if (!/^1\d{10}$/.test(phone)) return { success: false, error: '请输入正确手机号' }

  const { data } = await db.collection('users').where({ phone }).limit(1).get()
  if (!data || !data.length) return { success: false, error: '用户不存在' }

  const user = data[0]
  const now = formatDateTime(new Date())
  const updateData = { boundOpenid: openid, updatedAt: now }
  if (!user._openid) updateData._openid = openid
  await db.collection('users').doc(user._id).update({ data: updateData })

  const { data: updated } = await db.collection('users').doc(user._id).get()
  return { success: true, user: normalize(updated) }
}
