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

function normalizeRegisterType(value) {
  if (value === 'institution' || value === 'agent') return value
  return 'personal'
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

async function createReferralCode(userId, now) {
  const code = `R${String(userId).slice(-6).toUpperCase()}`
  await db.collection('users').doc(userId).update({ data: { referralCode: code, updatedAt: now } })
  return code
}

function buildBaseUser(openid, options = {}) {
  const now = options.now || formatDate(new Date())
  const customerType = normalizeCustomerType(options.customerType)
  return {
    _openid: openid,
    boundOpenid: openid,
    phone: options.phone || '',
    password: options.password || '',
    nickname: options.nickname || (options.phone ? `用户${String(options.phone).slice(-4)}` : '微信用户'),
    avatar: '',
    role: 'customer',
    customerType,
    verificationStatus: 'none',
    boundSalespersonId: options.referredBy || null,
    wallet: { balance: 0, rechargeHistory: [] },
    points: {
      balance: 200,
      history: [{ id: generateId('pts'), change: 200, balance: 200, reason: '注册赠送', createdAt: now }],
    },
    addresses: [],
    referralCode: '',
    ...(options.referredBy ? { referredBy: options.referredBy, referredAt: now } : {}),
    createdAt: now,
    updatedAt: now,
  }
}

async function createOpenidUser(openid, options = {}) {
  const now = formatDate(new Date())
  const referredBy = await resolveReferral(options.referralCode || '')
  const user = buildBaseUser(openid, { ...options, referredBy, now })
  const { _id } = await db.collection('users').add({ data: user })
  await createReferralCode(_id, now)
  const { data: created } = await db.collection('users').doc(_id).get()
  return created
}

async function registerUser(openid, event) {
  const phone = String(event.phone || '').trim()
  const password = String(event.password || '').trim()
  const nickname = String(event.nickname || '').trim() || `用户${phone.slice(-4)}`
  const registerType = normalizeRegisterType(event.registerType || event.customerType)
  const referralCode = String(event.referralCode || '').trim()

  if (!/^1\d{10}$/.test(phone)) return { success: false, error: '请输入正确手机号' }
  if (password.length < 6) return { success: false, error: '密码至少 6 位' }

  const { data: existingPhone } = await db.collection('users').where({ phone }).limit(1).get()
  if (existingPhone && existingPhone.length) return { success: false, error: '该手机号已注册' }

  const currentUser = await findUserByOpenid(openid)
  if (currentUser && currentUser.phone && currentUser.phone !== phone) {
    return { success: false, error: '当前微信已绑定其他手机号，请联系客服处理' }
  }

  const now = formatDateTime(new Date())
  const referredBy = await resolveReferral(referralCode)
  const customerType = registerType === 'institution' ? 'institution' : 'personal'
  const patch = {
    _openid: currentUser?._openid || openid,
    boundOpenid: openid,
    phone,
    password,
    nickname,
    name: nickname,
    role: 'customer',
    customerType,
    verificationStatus: 'none',
    boundSalespersonId: referredBy || currentUser?.boundSalespersonId || null,
    wallet: currentUser?.wallet || { balance: 0, rechargeHistory: [] },
    points: currentUser?.points || {
      balance: 200,
      history: [{ id: generateId('pts'), change: 200, balance: 200, reason: '注册赠送', createdAt: now }],
    },
    addresses: Array.isArray(currentUser?.addresses) ? currentUser.addresses : [],
    ...(referredBy ? { referredBy, referredAt: now } : {}),
    updatedAt: now,
  }

  if (registerType === 'agent') {
    patch.agentStatus = 'pending_review'
    patch.agentApplication = {
      status: 'pending_review',
      contactName: nickname,
      contactPhone: phone,
      submittedAt: now,
      reviewedAt: '',
      rejectReason: '',
    }
  }

  let userId = currentUser?._id
  if (userId) {
    await db.collection('users').doc(userId).update({ data: patch })
  } else {
    const doc = {
      ...buildBaseUser(openid, { phone, password, nickname, customerType, referredBy, now }),
      ...patch,
      createdAt: now,
    }
    const addResult = await db.collection('users').add({ data: doc })
    userId = addResult._id
  }

  if (!currentUser?.referralCode) await createReferralCode(userId, now)
  const { data: updated } = await db.collection('users').doc(userId).get()
  return { success: true, user: normalize(updated), registerType }
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

  if (action === 'register') return registerUser(openid, event)

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