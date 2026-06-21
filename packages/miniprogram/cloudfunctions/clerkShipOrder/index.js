const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateTime(date) {
  return `${formatDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function error(message, code = 'BAD_REQUEST') {
  return { success: false, code, error: message }
}

async function getCurrentUser(openid, operatorId) {
  if (operatorId) {
    try {
      const { data: user } = await db.collection('users').doc(operatorId).get()
      if (user && (!openid || user._openid === openid || user.boundOpenid === openid)) return user
    } catch (e) {
      // fall through to openid lookup
    }
  }

  if (openid) {
    const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
    if (data && data.length) return data[0]

    const { data: boundUsers } = await db.collection('users').where({ boundOpenid: openid }).limit(1).get()
    if (boundUsers && boundUsers.length) return boundUsers[0]
  }

  return null
}

function formatBeijingLogTime(date = new Date()) {
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const y = beijing.getUTCFullYear()
  const m = String(beijing.getUTCMonth() + 1).padStart(2, '0')
  const d = String(beijing.getUTCDate()).padStart(2, '0')
  const h = String(beijing.getUTCHours()).padStart(2, '0')
  const min = String(beijing.getUTCMinutes()).padStart(2, '0')
  const s = String(beijing.getUTCSeconds()).padStart(2, '0')
  return y + '-' + m + '-' + d + ' ' + h + ':' + min + ':' + s + '+08:00'
}

async function getOrder(orderId) {
  if (!orderId) return null
  try {
    const { data } = await db.collection('orders').doc(orderId).get()
    return data || null
  } catch (e) {
    return null
  }
}

function canShip(user, order) {
  const role = user && user.role
  if (['admin', 'system_admin', 'service'].includes(role)) return true
  if (role !== 'clerk') return false
  if (!order.clerkId) return true
  const assignedIds = Array.isArray(user.assignedOrderIds) ? user.assignedOrderIds : []
  return order.clerkId === user._id || assignedIds.includes(order._id)
}

function requiresColdChainShipping(order) {
  if (!order || order.type === 'booking') return false
  return (order.items || []).some((item) => {
    if (item.productType === 'blood_booking') return false
    return item.productType === 'blood_pack' ||
      item.isBloodPack === true ||
      /血|红细胞|血包/.test(String(item.productName || item.name || ''))
  })
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''

  const orderId = String(event.orderId || '').trim()
  const expressCompany = String(event.expressCompany || event.company || '').trim()
  const expressNo = String(event.expressNo || event.trackingNo || '').trim()
  const packageType = String(event.packageType || '').trim()
  const coldChainMethod = String(event.coldChainMethod || '').trim()
  const packageWeight = String(event.packageWeight || '').trim()
  const boxTemperature = String(event.boxTemperature || '').trim()
  const modifyReason = String(event.modifyReason || '').trim()
  const deliveryMode = String(event.deliveryMode || '').trim()
  const estimatedArrivalAt = String(event.estimatedArrivalAt || event.eta || '').trim()
  const abnormalFlag = !!event.abnormalFlag
  const abnormalType = abnormalFlag ? String(event.abnormalType || '').trim() : ''
  const abnormalReason = abnormalFlag ? String(event.abnormalReason || '').trim() : ''
  if (!orderId) return error('订单参数缺失')
  if (!openid && !String(event.operatorId || '').trim()) return error('登录状态无效', 'UNAUTHORIZED')

  const user = await getCurrentUser(openid, String(event.operatorId || '').trim())
  if (!user) return error('当前账号未绑定业务用户', 'FORBIDDEN')

  const order = await getOrder(orderId)
  if (!order) return error('订单不存在', 'NOT_FOUND')
  if (!canShip(user, order)) return error('无权处理该订单', 'FORBIDDEN')
  const isUrgentBooking = order.type === 'booking' && (order.booking?.urgent || order.shipping?.urgent)
  const isDirectDelivery = isUrgentBooking && deliveryMode === 'direct'
  const isModify = order.status === 'pending_receipt' || !!(order.shipping && order.shipping.trackingNo)
  if (!['pending_shipment', 'confirmed', 'preparing', 'pending_receipt'].includes(order.status)) {
    return error('当前订单状态不可发货', 'INVALID_STATUS')
  }
  if (isDirectDelivery) {
    if (!estimatedArrivalAt) return error('请填写预计到达时间')
    const departedAt = formatDateTime(new Date())
    const updateData = {
      'shipping.deliveryMode': 'direct',
      'shipping.company': '制单员线下配送',
      'shipping.trackingNo': '',
      'shipping.shippedAt': departedAt,
      'shipping.eta': estimatedArrivalAt,
      'shipping.temperature': '专人加急配送',
      'shipping.directDelivery': {
        status: 'departed',
        departedAt,
        estimatedArrivalAt,
        clerkId: user._id,
        clerkName: user.nickname || user.name || user.username || '制单员',
      },
      'shipping.logistics': _.push({
        time: departedAt,
        title: '制单员已出发',
        description: `加急预约订单已由制单员线下配送，预计 ${estimatedArrivalAt} 到达`,
        location: '仓库',
      }),
      status: 'pending_receipt',
      updatedAt: departedAt,
    }
    await db.collection('orders').doc(order._id).update({ data: updateData })
    await db.collection('logs').add({
      data: {
        operatorId: user._id,
        operatorName: user.nickname || user.name || user.username || '制单员',
        operatorRole: user.role,
        action: '加急配送出发',
        target: order._id,
        detail: `加急预约订单线下配送已出发，预计到达：${estimatedArrivalAt}`,
        result: 'success',
        createdAt: formatBeijingLogTime(),
      },
    })

    const updated = await getOrder(order._id)
    return { success: true, order: { ...updated, id: updated._id } }
  }
  if (isModify && !modifyReason) return error('请填写修改原因')
  if (!expressCompany) return error('请选择快递公司')
  if (!expressNo) return error('请填写快递单号')

  const needsColdChain = requiresColdChainShipping(order)
  if (needsColdChain) {
    if (!packageType) return error('请选择包装类型')
    if (!coldChainMethod) return error('请选择冷链方式')
    if (!boxTemperature) return error('请填写箱内温度')
  }

  if (abnormalFlag && (!abnormalType || !abnormalReason)) {
    return error('请填写异常类型和原因')
  }
  const validAbnormalTypes = ['partial', 'damaged', 'address_changed', 'near_expiry', 'other']
  if (abnormalFlag && !validAbnormalTypes.includes(abnormalType)) {
    return error('异常类型无效')
  }

  const shippedAt = formatDateTime(new Date())
  const updateData = {
    'shipping.trackingNo': expressNo,
    'shipping.company': expressCompany,
    'shipping.shippedAt': shippedAt,
    'shipping.eta': order.type === 'booking' ? '按预约时间送达' : '',
    'shipping.temperature': needsColdChain ? `${boxTemperature || '2-8'}°C 冷链` : '',
    ...(needsColdChain ? {
      'shipping.coldChain.packageType': packageType,
      'shipping.coldChain.method': coldChainMethod,
      'shipping.coldChain.weight': packageWeight,
      'shipping.coldChain.boxTemperature': boxTemperature,
    } : {}),
    'shipping.lastModifyReason': modifyReason,
    ...(abnormalFlag ? {
      'shipping.abnormal': {
        flagged: true,
        type: abnormalType,
        reason: abnormalReason,
        photos: Array.isArray(event.abnormalPhotos) ? event.abnormalPhotos : [],
        flaggedAt: shippedAt,
        flaggedBy: user._id,
      },
    } : {}),
    'shipping.logistics': _.push({
      time: shippedAt,
      title: isModify ? '物流信息已修改' : '商家已发货',
      description: isModify
        ? `制单员已修改物流信息：${modifyReason}`
        : '制单员已录入物流单号，包裹等待揽收或已交接承运方',
      location: '仓库',
    }),
    status: 'pending_receipt',
    updatedAt: shippedAt,
  }

  await db.collection('orders').doc(order._id).update({ data: updateData })
  await db.collection('logs').add({
    data: {
      operatorId: user._id,
      operatorName: user.nickname || user.name || user.username || '制单员',
      operatorRole: user.role,
      action: isModify ? '修改物流' : '录入物流',
      target: order._id,
      detail: `${isModify ? '修改' : '录入'} ${expressCompany} ${expressNo}${modifyReason ? `，原因：${modifyReason}` : ''}`,
      result: 'success',
      createdAt: formatBeijingLogTime(),
    },
  })

  const updated = await getOrder(order._id)
  return { success: true, order: { ...updated, id: updated._id } }
}
