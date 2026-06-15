const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const DEFAULT_DELIVERY_ID = 'SF'
const DEFAULT_PRINT_TYPE = 1

function error(message, code = 'BAD_REQUEST', extra = {}) {
  return { success: false, code, error: message, ...extra }
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatDateTime(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

function normalizeDoc(doc) {
  if (!doc) return doc
  const { _id, _openid, ...rest } = doc
  return { id: _id, ...rest }
}

function pickWaybillData(raw, key) {
  const list = Array.isArray(raw?.waybillData) ? raw.waybillData : []
  const item = list.find((entry) => entry && entry.key === key)
  return item ? item.value : ''
}

function normalizeWxExpressStatus(raw) {
  const waybillId = raw?.waybillId || raw?.waybill_id || raw?.waybillNo || raw?.waybill_no || ''
  const deliveryResultCode = raw?.deliveryResultcode ?? raw?.deliveryResultCode ?? raw?.delivery_resultcode
  const deliveryResultMsg = raw?.deliveryResultmsg || raw?.deliveryResultMsg || raw?.delivery_resultmsg || ''
  const status = raw?.status || raw?.orderStatus || raw?.order_status || ''
  return {
    waybillNo: String(waybillId || ''),
    deliveryResultCode,
    deliveryResultMsg,
    status: String(status || ''),
    isCorrectSender: raw?.isCorrectSender,
    isCorrectReceiver: raw?.isCorrectReceiver,
    routeLabel: pickWaybillData(raw, 'destRouteLabel'),
    originCode: pickWaybillData(raw, 'origincode'),
    destCode: pickWaybillData(raw, 'destcode'),
    printFlag: pickWaybillData(raw, 'printFlag'),
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

async function getOrderById(orderId) {
  try {
    const { data } = await db.collection('orders').doc(orderId).get()
    return data || null
  } catch (_e) {
    return null
  }
}

async function getOrderByWaybill(waybillNo) {
  if (!waybillNo) return null
  const { data } = await db.collection('orders')
    .where({ 'shipping.trackingNo': waybillNo })
    .limit(1)
    .get()
  return data && data.length ? data[0] : null
}

function canReadOrder(user, order, openid) {
  if (!user || !order) return false
  if (['admin', 'system_admin', 'service'].includes(user.role)) return true
  if (order.customerId === user._id) return true
  if (order.salespersonId === user._id) return true
  if (order.clerkId === user._id) return true
  if (order.customerOpenid && order.customerOpenid === openid) return true
  if (order._openid && order._openid === openid) return true
  const assignedIds = Array.isArray(user.assignedOrderIds) ? user.assignedOrderIds : []
  return assignedIds.includes(order._id)
}

function buildPayload(order, event) {
  const shipping = order.shipping || {}
  const wxExpress = shipping.wxExpress || {}
  const orderId = String(event.wxOrderId || event.wx_order_id || wxExpress.wxOrderId || order.orderNo || order._id || '').trim()
  const deliveryId = String(event.deliveryId || event.delivery_id || wxExpress.deliveryId || DEFAULT_DELIVERY_ID).trim()
  const waybillId = String(event.waybillId || event.waybillNo || event.trackingNo || shipping.trackingNo || wxExpress.waybillNo || '').trim()
  const openid = String(event.customerOpenid || event.openid || order.customerOpenid || '').trim()
  const printType = Number(event.printType || DEFAULT_PRINT_TYPE)

  return {
    openid,
    orderId,
    deliveryId,
    waybillId,
    printType: Number.isFinite(printType) ? printType : DEFAULT_PRINT_TYPE,
  }
}

async function queryWxOrder(payload) {
  if (!cloud.openapi || !cloud.openapi.logistics || !cloud.openapi.logistics.getOrder) {
    throw new Error('当前 wx-server-sdk 不支持 cloud.openapi.logistics.getOrder，请升级云函数依赖')
  }
  return cloud.openapi.logistics.getOrder(payload)
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''
  const operatorId = String(event.operatorId || event.userId || '').trim()
  const orderId = String(event.orderId || event.id || '').trim()
  const waybillNo = String(event.waybillNo || event.waybillId || event.trackingNo || '').trim()

  if (!orderId && !waybillNo) return error('请提供订单 ID 或顺丰运单号')
  if (!openid && !operatorId) return error('登录状态无效', 'UNAUTHORIZED')

  const user = await getCurrentUser(openid, operatorId)
  if (!user) return error('当前账号未绑定业务用户', 'FORBIDDEN')

  const order = orderId ? await getOrderById(orderId) : await getOrderByWaybill(waybillNo)
  if (!order) return error('订单不存在', 'NOT_FOUND')
  if (!canReadOrder(user, order, openid)) return error('无权查询该订单物流', 'FORBIDDEN')

  const payload = buildPayload(order, event)
  if (!payload.orderId) return error('微信物流订单号缺失', 'MISSING_WX_ORDER_ID', { order: normalizeDoc(order) })
  if (!payload.deliveryId) return error('快递公司编码缺失', 'MISSING_DELIVERY_ID', { order: normalizeDoc(order) })
  if (!payload.waybillId) return error('运单号缺失', 'MISSING_WAYBILL_ID', { order: normalizeDoc(order) })
  if (!payload.openid) return error('订单 openid 缺失，无法查询微信物流订单', 'MISSING_OPENID', { order: normalizeDoc(order) })

  let rawResult
  try {
    rawResult = await queryWxOrder(payload)
  } catch (e) {
    return error(e.message || '微信物流订单查询失败', 'WX_EXPRESS_QUERY_ERROR', {
      payload,
      rawError: e,
      order: normalizeDoc(order),
    })
  }

  const now = formatDateTime(new Date())
  const wxStatus = normalizeWxExpressStatus(rawResult)
  const nextWxExpress = {
    ...(order.shipping?.wxExpress || {}),
    lastQueryAt: now,
    lastQueryPayload: payload,
    lastQueryResult: rawResult,
    status: wxStatus.status,
    deliveryResultCode: wxStatus.deliveryResultCode,
    deliveryResultMsg: wxStatus.deliveryResultMsg,
    isCorrectSender: wxStatus.isCorrectSender,
    isCorrectReceiver: wxStatus.isCorrectReceiver,
  }

  if (wxStatus.waybillNo && !nextWxExpress.waybillNo) {
    nextWxExpress.waybillNo = wxStatus.waybillNo
  }

  await db.collection('orders').doc(order._id).update({
    data: {
      updatedAt: now,
      'shipping.wxExpress': nextWxExpress,
      'shipping.trackingNo': order.shipping?.trackingNo || wxStatus.waybillNo || payload.waybillId,
    },
  })

  return {
    success: true,
    orderId: order._id,
    wxOrderId: payload.orderId,
    deliveryId: payload.deliveryId,
    waybillNo: wxStatus.waybillNo || payload.waybillId,
    status: wxStatus,
    rawResult,
    order: normalizeDoc(order),
  }
}
