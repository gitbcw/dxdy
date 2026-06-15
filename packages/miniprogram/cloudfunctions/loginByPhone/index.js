const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const OPENID_BINDING_BYPASS_PHONES = new Set(['13833007890', '13821003456', '13811001234', '15526563256'])
const DEMO_PHONES = OPENID_BINDING_BYPASS_PHONES

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

async function findUsersBoundToOpenid(openid) {
  const byOpenid = await db.collection('users').where({ _openid: openid }).get()
  const byBoundOpenid = await db.collection('users').where({ boundOpenid: openid }).get()
  const map = new Map()
  for (const item of [...(byOpenid.data || []), ...(byBoundOpenid.data || [])]) {
    if (item && item._id) map.set(item._id, item)
  }
  return Array.from(map.values())
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return { success: false, error: '登录状态无效' }

  const phone = String(event.phone || '').trim()
  const password = String(event.password || '').trim()
  const canBypassOpenidExclusive = OPENID_BINDING_BYPASS_PHONES.has(phone)
  if (!/^1\d{10}$/.test(phone)) return { success: false, error: '请输入正确手机号' }
  if (!password) return { success: false, error: '请输入密码' }

  const { data } = await db.collection('users').where({ phone }).limit(1).get()
  if (!data || !data.length) return { success: false, error: '用户不存在' }

  const user = data[0]
  const expectedPassword = String(user.password || '123456')
  if (password !== expectedPassword) return { success: false, error: '账号或密码错误' }

  if (!canBypassOpenidExclusive) {
    const boundUsers = await findUsersBoundToOpenid(openid)
    const boundOtherUser = boundUsers.find((item) => item._id !== user._id)
    if (boundOtherUser) {
      return { success: false, error: '当前微信已绑定其他账号，请联系客服解绑' }
    }
    if ((user._openid && user._openid !== openid) || (user.boundOpenid && user.boundOpenid !== openid)) {
      return { success: false, error: '该手机号已绑定其他微信账号，请联系客服处理' }
    }
  }

  const now = formatDateTime(new Date())
  const updateData = { boundOpenid: openid, updatedAt: now }
  if (!user._openid || canBypassOpenidExclusive) updateData._openid = openid
  await db.collection('users').doc(user._id).update({ data: updateData })

  const { data: updated } = await db.collection('users').doc(user._id).get()
  return { success: true, user: normalize(updated) }
}
