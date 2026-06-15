const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const EFFECTIVE_STATUSES = [
  'pending_shipment',
  'preparing',
  'pending_receipt',
  'completed',
  'confirmed',
]

function ok(salesMap) {
  return { success: true, salesMap }
}

function normalizeProductIds(value) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(item => String(item || '').trim()).filter(Boolean))).slice(0, 100)
}

function addOrderSales(map, order, targetIds) {
  if (!order || order.type === 'recharge') return
  if (order.payment && order.payment.status && order.payment.status !== 'paid') return
  if (!Array.isArray(order.items)) return

  for (const item of order.items) {
    const productId = String(item.productId || '').trim()
    if (!productId) continue
    if (targetIds && !targetIds.has(productId)) continue
    const quantity = Math.max(0, Number(item.quantity || 0))
    if (!quantity) continue
    map[productId] = (map[productId] || 0) + quantity
  }
}

exports.main = async (event = {}) => {
  const productIds = normalizeProductIds(event.productIds)
  const salesMap = {}
  const targetIds = productIds.length ? new Set(productIds) : null

  if (targetIds) {
    for (const id of targetIds) salesMap[id] = 0
  }

  let query = db.collection('orders').where({
    status: _.in(EFFECTIVE_STATUSES),
    type: _.neq('recharge'),
  })

  // 云开发 where 对数组内字段的复合筛选能力有限，这里先按有效订单取最近数据再在内存里聚合。
  const pageSize = 100
  let offset = 0
  while (offset < 1000) {
    const { data } = await query
      .field({ items: true, type: true, status: true, payment: true })
      .skip(offset)
      .limit(pageSize)
      .get()
    const orders = data || []
    for (const order of orders) addOrderSales(salesMap, order, targetIds)
    if (orders.length < pageSize) break
    offset += pageSize
  }

  return ok(salesMap)
}
