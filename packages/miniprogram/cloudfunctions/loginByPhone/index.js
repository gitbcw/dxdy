const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const DEMO_PHONES = new Set(['13888002233', '13821003456', '13811001234', '13833007890'])

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
  const password = String(event.password || '').trim()
  const isDemoLogin = event.demo === true && DEMO_PHONES.has(phone)
  if (!/^1\d{10}$/.test(phone)) return { success: false, error: '请输入正确手机号' }
  if (!password) return { success: false, error: '请输入密码' }

  const { data } = await db.collection('users').where({ phone }).limit(1).get()
  if (!data || !data.length) return { success: false, error: '用户不存在' }

  const user = data[0]
  const expectedPassword = String(user.password || '123456')
  if (password !== expectedPassword) return { success: false, error: '账号或密码错误' }

  if (!isDemoLogin && ((user._openid && user._openid !== openid) || (user.boundOpenid && user.boundOpenid !== openid))) {
    return { success: false, error: '该手机号已绑定其他微信账号，请联系客服处理' }
  }
  const now = formatDateTime(new Date())
  const updateData = { boundOpenid: openid, updatedAt: now }
  if (!user._openid || isDemoLogin) updateData._openid = openid
  await db.collection('users').doc(user._id).update({ data: updateData })

  const { data: updated } = await db.collection('users').doc(user._id).get()
  return { success: true, user: normalize(updated) }
}
