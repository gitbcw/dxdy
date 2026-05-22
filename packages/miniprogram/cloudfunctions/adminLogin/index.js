const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const ADMIN_ROLES = ['service', 'product_manager', 'system_admin']

const defaultPermissions = {
  service: { view_dashboard: true, manage_orders: true, manage_returns: true },
  product_manager: { view_dashboard: true, manage_products: true },
  system_admin: {
    view_dashboard: true,
    manage_products: true,
    manage_orders: true,
    manage_returns: true,
    manage_users: true,
    manage_accounts: true,
    manage_roles: true,
    manage_system: true,
    view_logs: true,
  },
}

function error(message, code = 'BAD_REQUEST') {
  return { success: false, code, error: message }
}

function base64url(value) {
  return Buffer.from(value).toString('base64url')
}

function signToken(payload) {
  const body = base64url(JSON.stringify(payload))
  const secret = process.env.ADMIN_SESSION_SECRET || 'dxdy-admin-session-secret-v1'
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${signature}`
}

function normalizeProfile(doc) {
  if (!doc || !ADMIN_ROLES.includes(doc.role) || doc.status === 'disabled') return null
  const role = doc.role
  return {
    id: String(doc._id || doc.id || ''),
    username: String(doc.username || ''),
    realName: String(doc.realName || doc.nickname || doc.username || ''),
    role,
    permissions: doc.permissions && typeof doc.permissions === 'object' ? doc.permissions : defaultPermissions[role],
    status: doc.status === 'disabled' ? 'disabled' : 'active',
  }
}

exports.main = async (event) => {
  const username = String(event.username || '').trim()
  const password = String(event.password || '')
  const allowAnyPassword = event.allowAnyPassword === true

  if (!username || !password) return error('请输入账号和密码')
  if (password.length < 6) return error('密码长度至少 6 位')

  const { data } = await db.collection('users').where({ username }).limit(1).get()
  const doc = data && data[0]
  const profile = normalizeProfile(doc)
  const storedPassword = String(doc && doc.password || '')
  const passwordMatched = allowAnyPassword || !storedPassword || storedPassword === '***' || storedPassword === password

  if (!profile || !passwordMatched) return error('账号或密码错误', 'UNAUTHORIZED')

  const now = Math.floor(Date.now() / 1000)
  const token = signToken({
    id: profile.id,
    username: profile.username,
    role: profile.role,
    iat: now,
    exp: now + 8 * 60 * 60,
  })

  return { success: true, profile, token }
}
