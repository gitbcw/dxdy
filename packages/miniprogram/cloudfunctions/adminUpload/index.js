const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const ADMIN_ROLES = ['service', 'product_manager', 'system_admin', 'clerk']
const ALLOWED_PATH_PREFIXES = ['articles/', 'products/', 'card-vouchers/']

function error(message, code = 'BAD_REQUEST') {
  return { success: false, code, error: message }
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [body, signature] = token.split('.')
  const secret = process.env.ADMIN_SESSION_SECRET || 'dxdy-admin-session-secret-v1'
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  if (signature !== expected) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch (e) {
    return null
  }
}

function isAllowedPath(cloudPath) {
  if (!cloudPath || typeof cloudPath !== 'string') return false
  return ALLOWED_PATH_PREFIXES.some(prefix => cloudPath.startsWith(prefix))
}

function isAllowedType(mimeType) {
  if (!mimeType || typeof mimeType !== 'string') return false
  return ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType.toLowerCase())
}

function isAllowedSize(size) {
  return typeof size === 'number' && size > 0 && size <= 2 * 1024 * 1024
}

exports.main = async (event = {}) => {
  const payload = verifyToken(event.token)
  if (!payload) return error('登录状态无效，请重新登录', 'UNAUTHORIZED')

  if (!ADMIN_ROLES.includes(payload.role)) {
    return error('无权上传文件', 'FORBIDDEN')
  }

  const cloudPath = String(event.cloudPath || '')
  const base64Data = String(event.base64Data || '')
  const mimeType = String(event.mimeType || '')
  const size = Number(event.size || 0)

  if (!isAllowedPath(cloudPath)) return error('不允许上传到此路径', 'FORBIDDEN')
  if (!base64Data) return error('缺少文件数据')
  if (!isAllowedType(mimeType)) return error('仅支持 JPG、PNG、WebP 格式')
  if (!isAllowedSize(size)) return error('文件大小不能超过 2MB')

  try {
    const buffer = Buffer.from(base64Data, 'base64')
    const { fileID } = await cloud.uploadFile({
      cloudPath,
      fileContent: buffer,
    })
    return {
      success: true,
      data: { fileID, cloudPath },
    }
  } catch (e) {
    return error(e.message || '上传失败', 'UPLOAD_ERROR')
  }
}
