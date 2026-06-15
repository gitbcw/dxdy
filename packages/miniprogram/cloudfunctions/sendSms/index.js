const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const SMS_HOST = process.env.ALIYUN_SMS_HOST || 'gyytz.market.alicloudapi.com'
const SMS_PATH = process.env.ALIYUN_SMS_PATH || '/sms/smsSend'
const SMS_APPCODE = process.env.ALIYUN_SMS_APPCODE || ''
const SMS_SIGN_ID = process.env.ALIYUN_SMS_SIGN_ID || ''
const SMS_TEMPLATE_ID = process.env.ALIYUN_SMS_TEMPLATE_ID || ''
const SMS_CODE_TEMPLATE_ID = process.env.ALIYUN_SMS_CODE_TEMPLATE_ID || SMS_TEMPLATE_ID
const SMS_CODE_SIGN_ID = process.env.ALIYUN_SMS_CODE_SIGN_ID || SMS_SIGN_ID
const SMS_CODE_TTL_SECONDS = Math.max(Number(process.env.SMS_CODE_TTL_SECONDS || 300), 60)
const SMS_CODE_INTERVAL_SECONDS = Math.max(Number(process.env.SMS_CODE_INTERVAL_SECONDS || 60), 30)
const SMS_SECRET = process.env.SMS_CODE_SECRET || process.env.ADMIN_SESSION_SECRET || 'dxdy-sms-code-secret-v1'

function error(message, code = 'BAD_REQUEST', extra = {}) {
  return { success: false, code, error: message, ...extra }
}

function formatDateTime(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

function normalizeDoc(doc) {
  if (!doc || typeof doc !== 'object') return null
  const { _id, _openid, boundOpenid, password, ...rest } = doc
  return { id: _id, ...rest }
}

function verifyAdminToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [body, signature] = token.split('.')
  const secret = process.env.ADMIN_SESSION_SECRET || 'dxdy-admin-session-secret-v1'
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  if (signature !== expected) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch (_e) {
    return null
  }
}

async function getCurrentUser(openid, userId) {
  if (userId) {
    try {
      const { data } = await db.collection('users').doc(userId).get()
      if (data) return data
    } catch (_e) {
      return null
    }
  }

  if (!openid) return null
  const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
  if (data && data.length) return data[0]
  const { data: boundUsers } = await db.collection('users').where({ boundOpenid: openid }).limit(1).get()
  return boundUsers && boundUsers.length ? boundUsers[0] : null
}

function canSendStaffSms(user, adminPayload) {
  if (adminPayload && ['system_admin', 'service', 'clerk'].includes(adminPayload.role)) return true
  if (!user || user.status === 'disabled') return false
  return ['admin', 'system_admin', 'service', 'clerk'].includes(user.role)
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\s+/g, '')
}

function isChinaMobile(phone) {
  return /^1[3-9]\d{9}$/.test(phone)
}

function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

function normalizeTemplateParams(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return {}
  return Object.keys(params).reduce((acc, key) => {
    const value = params[key]
    if (value === undefined || value === null) return acc
    acc[key] = String(value)
    return acc
  }, {})
}

function toSmsParam(params) {
  return JSON.stringify(normalizeTemplateParams(params))
}

function providerSuccess(payload) {
  const code = payload?.code ?? payload?.Code ?? payload?.status ?? payload?.Status
  const success = payload?.success ?? payload?.Success
  return success === true || code === 0 || code === '0' || code === 'OK' || code === '00000' || code === '200'
}

function providerMessage(payload) {
  return String(payload?.msg || payload?.message || payload?.Message || payload?.desc || payload?.Desc || '')
}

function hashCode(phone, code) {
  return crypto.createHmac('sha256', SMS_SECRET).update(`${phone}:${code}`).digest('hex')
}

function generateCode(length = 6) {
  const size = Math.min(Math.max(Number(length || 6), 4), 8)
  let code = ''
  for (let i = 0; i < size; i += 1) code += Math.floor(Math.random() * 10)
  return code
}

function requestAliyunSms({ mobile, smsSignId, templateId, params }) {
  if (!SMS_APPCODE) {
    return Promise.reject(new Error('短信接口未配置 AppCode'))
  }

  const form = new URLSearchParams()
  form.set('mobile', mobile)
  form.set('smsSignId', smsSignId)
  form.set('templateId', templateId)
  form.set('param', toSmsParam(params))

  const body = form.toString()
  const options = {
    hostname: SMS_HOST,
    path: SMS_PATH,
    method: 'POST',
    timeout: 10000,
    headers: {
      Authorization: `APPCODE ${SMS_APPCODE}`,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Content-Length': Buffer.byteLength(body),
    },
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseBody = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { responseBody += chunk })
      res.on('end', () => {
        let payload = null
        try {
          payload = responseBody ? JSON.parse(responseBody) : {}
        } catch (_e) {
          payload = { raw: responseBody }
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(providerMessage(payload) || `短信接口请求失败：${res.statusCode}`))
        }
        resolve(payload)
      })
    })
    req.on('timeout', () => {
      req.destroy(new Error('短信接口请求超时'))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function writeSmsLog(data) {
  try {
    await db.collection('sms_logs').add({ data })
  } catch (_e) {
    try {
      await db.collection('logs').add({ data: { type: 'sms', ...data } })
    } catch (__e) {
      // Logging must not block the main SMS flow.
    }
  }
}

async function findRecentCode(phone) {
  try {
    const { data } = await db.collection('sms_codes')
      .where({ phone, used: false })
      .orderBy('createdAtMs', 'desc')
      .limit(1)
      .get()
    return data && data[0] ? data[0] : null
  } catch (_e) {
    return null
  }
}

async function saveCode(phone, code, now, meta) {
  try {
    await db.collection('sms_codes').add({
      data: {
        phone,
        codeHash: hashCode(phone, code),
        used: false,
        createdAt: formatDateTime(new Date(now)),
        createdAtMs: now,
        expiresAt: formatDateTime(new Date(now + SMS_CODE_TTL_SECONDS * 1000)),
        expiresAtMs: now + SMS_CODE_TTL_SECONDS * 1000,
        ...meta,
      },
    })
  } catch (_e) {
    // Verification-code persistence depends on collection setup. Return a clear
    // failure instead of sending a code that cannot be verified later.
    throw new Error('短信验证码存储失败，请检查 sms_codes 集合')
  }
}

async function sendCode(event, wxContext) {
  const phone = normalizePhone(event.phone || event.mobile)
  if (!isChinaMobile(phone)) return error('请输入正确的手机号')

  const now = Date.now()
  const recent = await findRecentCode(phone)
  if (recent?.createdAtMs && now - Number(recent.createdAtMs) < SMS_CODE_INTERVAL_SECONDS * 1000) {
    return error('验证码发送过于频繁，请稍后再试', 'TOO_FREQUENT', {
      retryAfterSeconds: Math.ceil((SMS_CODE_INTERVAL_SECONDS * 1000 - (now - Number(recent.createdAtMs))) / 1000),
    })
  }

  const smsSignId = String(event.smsSignId || SMS_CODE_SIGN_ID || '').trim()
  const templateId = String(event.templateId || SMS_CODE_TEMPLATE_ID || '').trim()
  if (!smsSignId || !templateId) return error('短信签名或模板未配置', 'CONFIG_MISSING')

  const code = generateCode(event.codeLength)
  const params = normalizeTemplateParams({ code, ...(event.params || {}) })
  const payload = await requestAliyunSms({ mobile: phone, smsSignId, templateId, params })
  if (!providerSuccess(payload)) {
    return error(providerMessage(payload) || '短信发送失败', 'PROVIDER_ERROR', { provider: payload })
  }

  await saveCode(phone, code, now, {
    scene: String(event.scene || 'login'),
    openid: wxContext.OPENID || '',
  })

  await writeSmsLog({
    action: 'sendCode',
    phone: maskPhone(phone),
    scene: String(event.scene || 'login'),
    success: true,
    provider: payload,
    createdAt: formatDateTime(new Date(now)),
  })

  return {
    success: true,
    phone: maskPhone(phone),
    expiresIn: SMS_CODE_TTL_SECONDS,
  }
}

async function sendTemplateSms(event, wxContext, user, adminPayload) {
  const phone = normalizePhone(event.phone || event.mobile)
  if (!isChinaMobile(phone)) return error('请输入正确的手机号')
  if (!canSendStaffSms(user, adminPayload)) return error('无权发送短信', 'FORBIDDEN')

  const smsSignId = String(event.smsSignId || SMS_SIGN_ID || '').trim()
  const templateId = String(event.templateId || SMS_TEMPLATE_ID || '').trim()
  if (!smsSignId || !templateId) return error('短信签名或模板未配置', 'CONFIG_MISSING')

  const params = normalizeTemplateParams(event.params || {})
  const payload = await requestAliyunSms({ mobile: phone, smsSignId, templateId, params })
  const ok = providerSuccess(payload)
  const createdAt = formatDateTime(new Date())
  await writeSmsLog({
    action: 'sendTemplate',
    phone: maskPhone(phone),
    templateId,
    smsSignId,
    params,
    success: ok,
    provider: payload,
    operatorId: adminPayload?.id || user?._id || '',
    operatorRole: adminPayload?.role || user?.role || '',
    openid: wxContext.OPENID || '',
    createdAt,
  })

  if (!ok) return error(providerMessage(payload) || '短信发送失败', 'PROVIDER_ERROR', { provider: payload })
  return {
    success: true,
    phone: maskPhone(phone),
    provider: payload,
  }
}

async function verifyCode(event) {
  const phone = normalizePhone(event.phone || event.mobile)
  const code = String(event.code || '').trim()
  if (!isChinaMobile(phone) || !code) return error('手机号或验证码不正确')

  const latest = await findRecentCode(phone)
  if (!latest || latest.expiresAtMs < Date.now()) return error('验证码已过期，请重新获取', 'CODE_EXPIRED')
  if (latest.codeHash !== hashCode(phone, code)) return error('验证码错误', 'CODE_INVALID')

  await db.collection('sms_codes').doc(latest._id).update({
    data: {
      used: true,
      usedAt: formatDateTime(new Date()),
      usedAtMs: Date.now(),
    },
  })
  return { success: true, phone: maskPhone(phone) }
}

exports.main = async (event = {}) => {
  const action = String(event.action || 'sendTemplate').trim()
  const wxContext = cloud.getWXContext()
  const adminPayload = verifyAdminToken(event.token)
  const user = await getCurrentUser(wxContext.OPENID || '', String(event.userId || event.operatorId || '').trim())

  try {
    if (action === 'sendCode') return await sendCode(event, wxContext)
    if (action === 'verifyCode') return await verifyCode(event)
    if (action === 'sendTemplate') return await sendTemplateSms(event, wxContext, user, adminPayload)
    return error('未知短信操作')
  } catch (e) {
    await writeSmsLog({
      action,
      phone: maskPhone(normalizePhone(event.phone || event.mobile)),
      success: false,
      error: e.message || String(e),
      createdAt: formatDateTime(new Date()),
    })
    return error(e.message || '短信服务调用失败', 'SMS_ERROR')
  }
}
