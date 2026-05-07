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
  if (!openid && operatorId) {
    try {
      const { data: user } = await db.collection('users').doc(operatorId).get()
      return user || null
    } catch (e) {
      return null
    }
  }

  const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
  if (data && data.length) return data[0]

  const { data: boundUsers } = await db.collection('users').where({ boundOpenid: openid }).limit(1).get()
  if (boundUsers && boundUsers.length) return boundUsers[0]

  if (!operatorId) return null
  try {
    const { data: user } = await db.collection('users').doc(operatorId).get()
    if (!user) return null
    if (user._openid && user._openid !== openid) return null
    if (user.boundOpenid && user.boundOpenid !== openid) return null
    if (['clerk', 'admin', 'system_admin', 'service'].includes(user.role)) {
      await db.collection('users').doc(user._id).update({
        data: { boundOpenid: openid, updatedAt: formatDateTime(new Date()) },
      })
      return { ...user, boundOpenid: openid }
    }
    return user
  } catch (e) {
    return null
  }
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
  return order.clerkId === user._id
}

function hasBloodItem(order) {
  return (order.items || []).some((item) => String(item.productName || item.name || '').includes('血'))
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
  if (!orderId) return error('订单参数缺失')
  if (!expressCompany) return error('请选择快递公司')
  if (!expressNo) return error('请填写快递单号')
  if (!openid && !String(event.operatorId || '').trim()) return error('登录状态无效', 'UNAUTHORIZED')

  const user = await getCurrentUser(openid, String(event.operatorId || '').trim())
  if (!user) return error('当前账号未绑定业务用户', 'FORBIDDEN')

  const order = await getOrder(orderId)
  if (!order) return error('订单不存在', 'NOT_FOUND')
  if (!canShip(user, order)) return error('无权处理该订单', 'FORBIDDEN')
  const isModify = order.status === 'pending_receipt' || !!(order.shipping && order.shipping.trackingNo)
  if (!['pending_shipment', 'confirmed', 'pending_receipt'].includes(order.status)) {
    return error('当前订单状态不可发货', 'INVALID_STATUS')
  }
  if (isModify && !modifyReason) return error('请填写修改原因')
  if (hasBloodItem(order)) {
    if (!packageType) return error('请选择包装类型')
    if (!coldChainMethod) return error('请选择冷链方式')
    if (!boxTemperature) return error('请填写箱内温度')
  }

  const shippedAt = formatDateTime(new Date())
  const updateData = {
    'shipping.trackingNo': expressNo,
    'shipping.company': expressCompany,
    'shipping.shippedAt': shippedAt,
    'shipping.eta': order.type === 'booking' ? '按预约时间送达' : '',
    'shipping.temperature': hasBloodItem(order) ? `${boxTemperature || '2-8'}°C 冷链` : '',
    'shipping.coldChain.packageType': packageType,
    'shipping.coldChain.method': coldChainMethod,
    'shipping.coldChain.weight': packageWeight,
    'shipping.coldChain.boxTemperature': boxTemperature,
    'shipping.lastModifyReason': modifyReason,
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
      createdAt: shippedAt,
    },
  })

  const updated = await getOrder(order._id)
  return { success: true, order: { ...updated, id: updated._id } }
}
