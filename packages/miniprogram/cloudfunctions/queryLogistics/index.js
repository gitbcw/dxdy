const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const ALIYUN_LOGISTICS_HOST = process.env.ALIYUN_LOGISTICS_HOST || 'qryexpress.market.alicloudapi.com'
const ALIYUN_LOGISTICS_PATH = process.env.ALIYUN_LOGISTICS_PATH || '/lundear/expressTracking'
const ALIYUN_LOGISTICS_APPCODE = process.env.ALIYUN_LOGISTICS_APPCODE || ''

function error(message, code = 'BAD_REQUEST', extra = {}) {
  return { success: false, code, error: message, ...extra }
}

function normalize(doc) {
  if (!doc) return doc
  const { _id, _openid, ...rest } = doc
  return { id: _id, ...rest }
}

async function getCurrentUser(openid, userId) {
  if (userId) {
    try {
      const { data } = await db.collection('users').doc(userId).get()
      return data || null
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

function canReadOrder(user, order, openid) {
  if (!user || !order) return false
  if (order.customerId === user._id) return true
  if (order.salespersonId === user._id) return true
  if (order.clerkId === user._id) return true
  if (user.role === 'admin') return true
  if (order.customerOpenid && order.customerOpenid === openid) return true
  if (order._openid && order._openid === openid) return true
  return false
}

function pickPhone(order) {
  const shipping = order.shipping || {}
  const address = shipping.address || order.shippingAddress || {}
  return String(address.phone || order.customerPhone || '').trim()
}

function normalizeProviderTrack(item) {
  if (!item || typeof item !== 'object') return null
  const title = item.status || item.title || item.context || item.desc || item.description || '物流更新'
  const time = item.time || item.ftime || item.datetime || item.acceptTime || ''
  const desc = item.context || item.desc || item.description || item.status || ''
  return {
    title: String(title || '物流更新'),
    time: String(time || ''),
    desc: String(desc || ''),
    active: true,
    source: 'aliyun',
  }
}

function normalizeProviderResponse(payload) {
  const data = payload && typeof payload === 'object' ? payload.data : null
  const list = Array.isArray(data?.list)
    ? data.list
    : Array.isArray(data?.traces)
      ? data.traces
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(payload?.list)
          ? payload.list
          : []
  return {
    providerCode: payload?.code,
    providerMessage: payload?.desc || payload?.msg || payload?.message || '',
    company: data?.company || data?.expressCompany || data?.expName || '',
    trackingNo: data?.number || data?.nu || data?.trackingNo || '',
    state: data?.state || data?.status || '',
    tracks: list.map(normalizeProviderTrack).filter(Boolean),
    raw: payload,
  }
}

function requestAliyunLogistics({ trackingNo, mobile }) {
  if (!ALIYUN_LOGISTICS_APPCODE) {
    return Promise.reject(new Error('物流接口未配置 AppCode'))
  }

  const query = new URLSearchParams()
  query.set('number', trackingNo)
  if (mobile) query.set('mobile', mobile)
  const options = {
    hostname: ALIYUN_LOGISTICS_HOST,
    path: `${ALIYUN_LOGISTICS_PATH}?${query.toString()}`,
    method: 'GET',
    timeout: 10000,
    headers: {
      Authorization: `APPCODE ${ALIYUN_LOGISTICS_APPCODE}`,
    },
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        let payload = null
        try {
          payload = body ? JSON.parse(body) : null
        } catch (_e) {
          return reject(new Error('物流接口返回格式异常'))
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(payload?.message || payload?.desc || `物流接口请求失败：${res.statusCode}`))
        }
        resolve(payload)
      })
    })
    req.on('timeout', () => {
      req.destroy(new Error('物流接口请求超时'))
    })
    req.on('error', reject)
    req.end()
  })
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''
  const orderId = String(event.orderId || event.id || '').trim()
  if (!orderId) return error('订单参数缺失')

  const user = await getCurrentUser(openid, String(event.userId || '').trim())
  if (!user) return error('当前账号未登录', 'UNAUTHORIZED')

  let order = null
  try {
    const { data } = await db.collection('orders').doc(orderId).get()
    order = data || null
  } catch (_e) {
    order = null
  }
  if (!order) return error('订单不存在', 'NOT_FOUND')
  if (!canReadOrder(user, order, openid)) return error('无权查看该订单物流', 'FORBIDDEN')

  const shipping = order.shipping || {}
  const trackingNo = String(event.trackingNo || shipping.trackingNo || '').trim()
  const mobile = String(event.mobile || pickPhone(order)).trim()
  if (!trackingNo) {
    return error('暂无物流单号', 'NO_TRACKING_NO', { order: normalize(order) })
  }

  try {
    const payload = await requestAliyunLogistics({ trackingNo, mobile })
    const provider = normalizeProviderResponse(payload)
    const ok = payload?.code === 0 || payload?.code === '0' || provider.tracks.length > 0
    return {
      success: true,
      realtime: ok,
      provider,
      order: normalize(order),
    }
  } catch (e) {
    return error(e.message || '物流查询失败', 'PROVIDER_ERROR', {
      order: normalize(order),
    })
  }
}
