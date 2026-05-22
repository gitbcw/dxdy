const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

function normalize(doc) {
  if (!doc) return doc
  const { _id, _openid, ...rest } = doc
  return { id: _id, ...rest }
}

function normalizeCustomerType(value) {
  return value === 'institution' ? 'institution' : 'personal'
}

async function findUserByOpenid(openid) {
  const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
  if (data && data.length) return data[0]
  const { data: boundUsers } = await db.collection('users').where({ boundOpenid: openid }).limit(1).get()
  return boundUsers && boundUsers.length ? boundUsers[0] : null
}

async function resolveReferral(referralCode) {
  if (!referralCode) return ''
  const { data: referrers } = await db.collection('users').where({ referralCode }).limit(1).get()
  return referrers && referrers.length ? String(referrers[0]._id || '') : ''
}

async function createOpenidUser(openid, options = {}) {
  const now = formatDate(new Date())
  const referredBy = await resolveReferral(options.referralCode || '')
  const user = {
    _openid: openid,
    boundOpenid: openid,
    phone: '',
    nickname: options.nickname || '微信用户',
    avatar: '',
    role: 'customer',
    customerType: normalizeCustomerType(options.customerType),
    verificationStatus: 'none',
    boundSalespersonId: null,
    wallet: { balance: 0, rechargeHistory: [] },
    points: {
      balance: 200,
      history: [{ id: generateId('pts'), change: 200, balance: 200, reason: '注册赠送', createdAt: now }],
    },
    addresses: [],
    referralCode: '',
    ...(referredBy ? { referredBy, referredAt: now } : {}),
    createdAt: now,
    updatedAt: now,
  }

  const { _id } = await db.collection('users').add({ data: user })
  const code = `R${String(_id).slice(-6).toUpperCase()}`
  await db.collection('users').doc(_id).update({ data: { referralCode: code, updatedAt: now } })
  const { data: created } = await db.collection('users').doc(_id).get()
  return created
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return { success: false, error: '登录状态无效' }

  const action = String(event.action || (event.phone ? 'bindPhone' : 'ensure')).trim()
  const phone = String(event.phone || '').trim()
  const nickname = String(event.nickname || '').trim()
  const referralCode = String(event.referralCode || '').trim()
  const customerType = normalizeCustomerType(event.customerType)

  if (action === 'ensure') {
    const existing = await findUserByOpenid(openid)
    const user = existing || await createOpenidUser(openid, { referralCode, customerType, nickname })
    return { success: true, user: normalize(user), created: !existing }
  }

  if (action !== 'bindPhone') {
    return { success: false, error: '不支持的操作' }
  }

  if (!/^1\d{10}$/.test(phone)) return { success: false, error: '请输入正确手机号' }

  const { data: existingPhone } = await db.collection('users').where({ phone }).limit(1).get()
  const currentUser = await findUserByOpenid(openid)
  const user = currentUser || await createOpenidUser(openid, { referralCode, customerType, nickname })

  if (existingPhone && existingPhone.length && existingPhone[0]._id !== user._id) {
    return { success: false, error: '该手机号已被其他账号绑定' }
  }

  const now = formatDate(new Date())
  await db.collection('users').doc(user._id).update({
    data: {
      _openid: user._openid || openid,
      boundOpenid: openid,
      phone,
      nickname: nickname || user.nickname || '微信用户',
      customerType,
      updatedAt: now,
    },
  })

  const { data: updated } = await db.collection('users').doc(user._id).get()
  return { success: true, user: normalize(updated) }
}
