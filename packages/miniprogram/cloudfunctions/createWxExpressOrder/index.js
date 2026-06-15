const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const DELIVERY_ID = 'SF'
const BIZ_ID = 'SF_CASH'
const FALLBACK_SHOP_IMAGE = 'https://mmbiz.qpic.cn/mmbiz_png/OiaFLUqewuIDNQnTiaCInIG8ibdosYHhQHPbXJUrqYSNIcBL60vo4LIjlcoNG1QPkeH5GWWEB41Ny895CokeAah8A/640'

function error(message, code = 'BAD_REQUEST', extra = {}) {
  return { success: false, code, error: message, ...extra }
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatDateTime(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

function parseExpectTime(value) {
  const text = String(value || '').trim()
  if (!text) return null
  const date = new Date(text.replace(/-/g, '/'))
  if (Number.isNaN(date.getTime())) return null
  return {
    text,
    timestamp: Math.floor(date.getTime() / 1000),
    date,
  }
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\s+/g, '')
}

function requireText(value, label) {
  const text = String(value || '').trim()
  if (!text) throw new Error(`请填写${label}`)
  return text
}

function getAddressText(address) {
  if (!address) return ''
  return String(address.full || address.address || `${address.province || ''}${address.city || ''}${address.district || ''}${address.detail || ''}`).trim()
}

function getRegion(address) {
  return {
    province: String(address?.province || '').trim(),
    city: String(address?.city || '').trim(),
    district: String(address?.district || address?.county || '').trim(),
  }
}

async function getCurrentUser(openid, operatorId) {
  if (operatorId) {
    try {
      const { data } = await db.collection('users').doc(operatorId).get()
      if (data && (!openid || data._openid === openid || data.boundOpenid === openid)) return data
    } catch (_e) {
      // Fall through to openid lookup.
    }
  }

  if (!openid) return null
  const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
  if (data && data.length) return data[0]

  const { data: boundUsers } = await db.collection('users').where({ boundOpenid: openid }).limit(1).get()
  return boundUsers && boundUsers.length ? boundUsers[0] : null
}

async function getOrder(orderId) {
  try {
    const { data } = await db.collection('orders').doc(orderId).get()
    return data || null
  } catch (_e) {
    return null
  }
}

function canCreateExpressOrder(user, order) {
  if (!user || !order) return false
  if (['admin', 'system_admin', 'service'].includes(user.role)) return true
  if (user.role !== 'clerk') return false
  const assignedIds = Array.isArray(user.assignedOrderIds) ? user.assignedOrderIds : []
  return order.clerkId === user._id || assignedIds.includes(order._id)
}

function buildCargo(order, event) {
  const items = Array.isArray(order.items) ? order.items : []
  const count = items.reduce((sum, item) => sum + Number(item.quantity || 1), 0)
  const detailList = items.slice(0, 6).map((item) => ({
    name: String(item.productName || item.name || '宠物医疗用品').slice(0, 32),
    count: Number(item.quantity || 1),
  }))
  return {
    count: Math.max(1, count),
    weight: Number(event.weight || event.cargoWeight || 1),
    spaceX: 0,
    spaceY: 0,
    spaceZ: 0,
    detailList: detailList.length ? detailList : [{ name: '宠物医疗用品', count: 1 }],
  }
}

function pickShopImage(order) {
  const items = Array.isArray(order.items) ? order.items : []
  const image = items
    .map((item) => item.productImage || item.imageUrl || item.image)
    .find((url) => /^https:\/\//.test(String(url || '')))
  return image || FALLBACK_SHOP_IMAGE
}

function buildAddOrderPayload({ order, event, sender, receiver, now }) {
  const cargoName = String(event.cargoName || '宠物医疗用品').trim() || '宠物医疗用品'
  const remark = String(event.remark || '').trim()
  const expectTime = event.expectTimeInfo
  const shopOrderId = String(order.orderNo || order._id)
  return {
    orderId: shopOrderId,
    openid: order.customerOpenid || '',
    deliveryId: DELIVERY_ID,
    bizId: BIZ_ID,
    customRemark: remark,
    sender,
    receiver,
    cargo: {
      ...buildCargo(order, event),
      name: cargoName,
    },
    shop: {
      wxaPath: `/pages/orders/order-detail/order-detail?id=${order._id}`,
      imgUrl: pickShopImage(order),
      goodsName: cargoName,
      goodsCount: Number(order.items?.length || 1),
    },
    insured: {
      useInsured: 0,
      insuredValue: 0,
    },
    service: {
      serviceType: 0,
      serviceName: '标准快递',
    },
    expectTime: expectTime.timestamp,
    createdAt: now,
  }
}

async function addWxExpressOrder(payload) {
  if (!cloud.openapi || !cloud.openapi.logistics || !cloud.openapi.logistics.addOrder) {
    throw new Error('当前 wx-server-sdk 不支持 cloud.openapi.logistics.addOrder，请升级云函数依赖或微信基础库')
  }
  return cloud.openapi.logistics.addOrder(payload)
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''
  const operatorId = String(event.operatorId || '').trim()
  const orderId = String(event.orderId || '').trim()
  if (!orderId) return error('订单参数缺失')
  if (!openid && !operatorId) return error('登录状态无效', 'UNAUTHORIZED')

  const user = await getCurrentUser(openid, operatorId)
  if (!user) return error('当前账号未绑定业务用户', 'FORBIDDEN')
  if (user.role !== 'clerk' && !['admin', 'system_admin', 'service'].includes(user.role)) {
    return error('仅制单员或后台人员可预约顺丰揽收', 'FORBIDDEN')
  }

  const order = await getOrder(orderId)
  if (!order) return error('订单不存在', 'NOT_FOUND')
  if (!canCreateExpressOrder(user, order)) return error('无权处理该订单', 'FORBIDDEN')
  if (!['pending_shipment', 'confirmed', 'preparing'].includes(order.status)) {
    return error('当前订单状态不可预约揽收', 'INVALID_STATUS')
  }
  if (order.type === 'booking' && (order.booking?.urgent || order.shipping?.urgent)) {
    return error('加急预约订单不走顺丰揽收', 'INVALID_ORDER_TYPE')
  }

  let senderName
  let senderMobile
  let senderAddress
  let expectTime
  try {
    senderName = requireText(event.senderName, '寄件人姓名')
    senderMobile = normalizePhone(requireText(event.senderMobile, '寄件人手机号'))
    senderAddress = {
      province: requireText(event.senderProvince, '寄件省份'),
      city: requireText(event.senderCity, '寄件城市'),
      area: requireText(event.senderDistrict, '寄件区县'),
      address: requireText(event.senderAddress, '寄件详细地址'),
    }
    const parsedExpectTime = parseExpectTime(requireText(event.expectTime, '上门揽收时间'))
    if (!parsedExpectTime) throw new Error('上门揽收时间格式无效')
    if (parsedExpectTime.date.getTime() <= Date.now()) throw new Error('上门揽收时间必须晚于当前时间')
    expectTime = parsedExpectTime
  } catch (e) {
    return error(e.message)
  }
  if (!/^1\d{10}$/.test(senderMobile)) return error('请填写有效的寄件人手机号')
  if (!Number.isFinite(Number(event.weight)) || Number(event.weight) <= 0) return error('请填写有效的包裹重量')

  const shipping = order.shipping || {}
  const receiverAddress = shipping.address || order.shippingAddress || {}
  const receiverPhone = normalizePhone(receiverAddress.phone || order.customerPhone)
  const receiverName = String(receiverAddress.name || order.customerName || '').trim()
  const receiverFullAddress = getAddressText(receiverAddress)
  if (!receiverName || !receiverPhone || !receiverFullAddress) {
    return error('订单收件信息不完整，无法预约顺丰揽收', 'MISSING_RECEIVER')
  }
  const receiverRegion = getRegion(receiverAddress)
  const receiver = {
    name: receiverName,
    tel: receiverPhone,
    mobile: receiverPhone,
    company: order.customerName || '',
    post_code: '',
    country: '中国',
    province: receiverRegion.province,
    city: receiverRegion.city,
    area: receiverRegion.district,
    address: receiverAddress.detail || receiverFullAddress,
  }
  const sender = {
    name: senderName,
    tel: senderMobile,
    mobile: senderMobile,
    company: user.realName || user.nickname || senderName,
    post_code: '',
    country: '中国',
    ...senderAddress,
  }

  const now = formatDateTime(new Date())
  const payload = buildAddOrderPayload({ order, event: { ...event, expectTimeInfo: expectTime }, sender, receiver, now })

  let addResult
  try {
    addResult = await addWxExpressOrder(payload)
  } catch (e) {
    return error(e.message || '微信物流助手下单失败', 'WX_EXPRESS_ERROR', { rawError: e })
  }

  const waybillNo = String(addResult?.waybillId || addResult?.waybill_id || addResult?.waybill_no || addResult?.waybillNo || '').trim()
  const wxOrderId = String(addResult?.orderId || addResult?.order_id || payload.orderId || '').trim()
  const expressInfo = {
    provider: 'wechat_logistics',
    deliveryId: DELIVERY_ID,
    bizId: BIZ_ID,
    wxOrderId,
    waybillNo,
    pickupStatus: 'waiting_pickup',
    expectTime: expectTime.text,
    cargoName: payload.cargo.name,
    weight: Number(event.weight),
    remark: String(event.remark || '').trim(),
    noPrintByClerk: true,
    sender: {
      name: senderName,
      mobile: senderMobile,
      province: senderAddress.province,
      city: senderAddress.city,
      district: senderAddress.area,
      address: senderAddress.address,
    },
    createdBy: user._id,
    createdAt: now,
    rawResult: addResult,
  }

  await db.collection('orders').doc(order._id).update({
    data: {
      status: 'preparing',
      updatedAt: now,
      'shipping.provider': 'SF',
      'shipping.company': '顺丰速运',
      'shipping.trackingNo': waybillNo || null,
      'shipping.deliveryMode': 'sf_pickup',
      'shipping.wxExpress': expressInfo,
      'shipping.logistics': _.push({
        time: now,
        title: '已预约顺丰上门揽收',
        description: `制单员已预约 ${expectTime.text} 上门揽收，快递员上门时打印/粘贴电子面单`,
        location: '寄件点',
      }),
    },
  })

  await db.collection('logs').add({
    data: {
      operatorId: user._id,
      operatorName: user.realName || user.nickname || user.name || user.username || senderName,
      operatorRole: user.role,
      action: '预约顺丰揽收',
      target: order._id,
      detail: `订单 ${order.orderNo || order._id} 已预约顺丰散单揽收，预计揽收时间：${expectTime.text}`,
      result: 'success',
      createdAt: now,
    },
  })

  return {
    success: true,
    orderId: order._id,
    deliveryId: DELIVERY_ID,
    bizId: BIZ_ID,
    waybillNo,
    wxOrderId,
    pickupStatus: 'waiting_pickup',
    expectTime: expectTime.text,
  }
}
