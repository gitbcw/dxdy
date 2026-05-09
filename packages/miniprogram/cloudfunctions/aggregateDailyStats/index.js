const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const PAGE_SIZE = 200

/**
 * 每日数据分析聚合云函数
 * 定时触发（每日 00:30 北京时间）或手动调用
 *
 * 入参：{ date?: string }  — 不传则取昨天
 * 输出：{ success: true, date, docId }
 */
exports.main = async (event) => {
  const targetDate = event.date || getDateStr(-1)
  const nextDate = getDateStr(0, new Date(targetDate + 'T00:00:00+08:00'))

  console.log(`[aggregateDailyStats] aggregating for ${targetDate}`)

  // 1. 埋点事件汇总
  const tracking = await aggregateTracking(targetDate, nextDate)

  // 2. 订单汇总
  const orders = await aggregateOrders(targetDate, nextDate)

  // 3. 新客汇总
  const customers = await aggregateCustomers(targetDate, nextDate)

  // 4. 复购客户（期间下单 ≥ 2 的客户）
  const repeatCount = await countRepeatCustomers(targetDate, nextDate)

  // 5. 退款
  const refunds = await aggregateRefunds(targetDate, nextDate)

  // 6. 代理贡献
  const agentContribution = await aggregateAgentContribution(targetDate, nextDate)

  // 7. 热门商品
  const topProducts = await aggregateTopProducts(targetDate, nextDate)

  const docId = `daily_${targetDate}`
  const metrics = {
    revenue: orders.totalRevenue,
    orderCount: orders.totalCount,
    avgOrderValue: orders.totalCount > 0 ? Math.round(orders.totalRevenue / orders.totalCount) : 0,
    newCustomers: customers.newCount,
    activeCustomers: orders.activeCustomers,
    repeatCustomers: repeatCount,
    pageViews: tracking.pageViews,
    productViews: tracking.productViews,
    addToCarts: tracking.addToCarts,
    orderSubmits: tracking.orderSubmits,
    orderPayments: tracking.orderPayments,
    refundAmount: refunds.totalAmount,
    refundCount: refunds.totalCount,
  }

  const byCustomerType = {
    institution: {
      revenue: orders.institutionRevenue,
      orderCount: orders.institutionCount,
      newCustomers: customers.institutionNew,
    },
    personal: {
      revenue: orders.personalRevenue,
      orderCount: orders.personalCount,
      newCustomers: customers.personalNew,
    },
  }

  const doc = {
    date: targetDate,
    metrics,
    topProducts,
    agentContribution,
    byCustomerType,
    createdAt: new Date().toISOString(),
  }

  // Upsert
  try {
    await db.collection('analytics_daily').doc(docId).set({ data: doc })
  } catch {
    await db.collection('analytics_daily').add({ data: { _id: docId, ...doc } })
  }

  console.log(`[aggregateDailyStats] done: ${docId}`, JSON.stringify(metrics))

  return { success: true, date: targetDate, docId }
}

// ---- Helpers ----

function getDateStr(offsetDays, baseDate) {
  const d = baseDate ? new Date(baseDate) : new Date()
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateRange(dateStr) {
  const start = new Date(dateStr + 'T00:00:00+08:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

async function fetchAll(collection, query, select) {
  const results = []
  let offset = 0
  let hasMore = true
  while (hasMore) {
    let q = db.collection(collection).where(query).skip(offset).limit(PAGE_SIZE)
    if (select) q = q.field(select)
    const { data } = await q.get()
    results.push(...data)
    offset += PAGE_SIZE
    hasMore = data.length === PAGE_SIZE
  }
  return results
}

async function aggregateTracking(dateStr, nextDateStr) {
  // tracking_events_batch: events[].timestamp 在 [date, nextDate)
  const { start, end } = dateRange(dateStr)
  const startISO = start.toISOString()
  const endISO = end.toISOString()

  const batches = await fetchAll('tracking_events_batch', {
    createdAt: _.gte(startISO).and(_.lt(endISO)),
  })

  let pageViews = 0, productViews = 0, addToCarts = 0, orderSubmits = 0, orderPayments = 0

  for (const batch of batches) {
    const events = batch.events || []
    for (const evt of events) {
      const t = evt.eventType
      if (t === 'page_view') pageViews++
      else if (t === 'product_view') productViews++
      else if (t === 'add_to_cart') addToCarts++
      else if (t === 'order_submit') orderSubmits++
      else if (t === 'order_pay') orderPayments++
    }
  }

  return { pageViews, productViews, addToCarts, orderSubmits, orderPayments }
}

async function aggregateOrders(dateStr, nextDateStr) {
  const { start, end } = dateRange(dateStr)
  const startISO = start.toISOString()
  const endISO = end.toISOString()

  const orders = await fetchAll('orders', {
    createdAt: _.gte(startISO).and(_.lt(endISO)),
    status: _.neq('cancelled'),
  }, { totalAmount: true, customerId: true, customerType: true, status: true })

  let totalRevenue = 0
  let institutionRevenue = 0, institutionCount = 0
  let personalRevenue = 0, personalCount = 0
  const customerSet = new Set()

  for (const o of orders) {
    const amt = o.totalAmount || 0
    totalRevenue += amt
    customerSet.add(o.customerId)
    if (o.customerType === 'institution') {
      institutionRevenue += amt
      institutionCount++
    } else {
      personalRevenue += amt
      personalCount++
    }
  }

  return {
    totalRevenue,
    totalCount: orders.length,
    institutionRevenue,
    institutionCount,
    personalRevenue,
    personalCount,
    activeCustomers: customerSet.size,
  }
}

async function aggregateCustomers(dateStr, nextDateStr) {
  const { start, end } = dateRange(dateStr)
  const startISO = start.toISOString()
  const endISO = end.toISOString()

  const users = await fetchAll('users', {
    role: 'customer',
    createdAt: _.gte(startISO).and(_.lt(endISO)),
  }, { customerType: true })

  let institutionNew = 0, personalNew = 0
  for (const u of users) {
    if (u.customerType === 'institution') institutionNew++
    else personalNew++
  }

  return { newCount: users.length, institutionNew, personalNew }
}

async function countRepeatCustomers(dateStr, nextDateStr) {
  const { start, end } = dateRange(dateStr)
  const startISO = start.toISOString()
  const endISO = end.toISOString()

  const orders = await fetchAll('orders', {
    createdAt: _.gte(startISO).and(_.lt(endISO)),
    status: _.neq('cancelled'),
  }, { customerId: true })

  const counts = {}
  for (const o of orders) {
    const cid = o.customerId
    if (!cid) continue
    counts[cid] = (counts[cid] || 0) + 1
  }

  return Object.values(counts).filter(c => c >= 2).length
}

async function aggregateRefunds(dateStr, nextDateStr) {
  const { start, end } = dateRange(dateStr)
  const startISO = start.toISOString()
  const endISO = end.toISOString()

  const returns = await fetchAll('returns', {
    createdAt: _.gte(startISO).and(_.lt(endISO)),
    status: _.in(['approved', 'refunded']),
  }, { refundAmount: true })

  let totalAmount = 0
  for (const r of returns) {
    totalAmount += r.refundAmount || 0
  }

  return { totalAmount, totalCount: returns.length }
}

async function aggregateAgentContribution(dateStr, nextDateStr) {
  const { start, end } = dateRange(dateStr)
  const startISO = start.toISOString()
  const endISO = end.toISOString()

  const records = await fetchAll('commission_records', {
    createdAt: _.gte(startISO).and(_.lt(endISO)),
  }, { salespersonId: true, salespersonName: true, orderAmount: true, commission: true })

  const map = {}
  for (const r of records) {
    const sid = r.salespersonId || 'unknown'
    if (!map[sid]) {
      map[sid] = { salespersonId: sid, salespersonName: r.salespersonName || '未知', orderCount: 0, revenue: 0, commission: 0 }
    }
    map[sid].orderCount++
    map[sid].revenue += r.orderAmount || 0
    map[sid].commission += r.commission || 0
  }

  return Object.values(map)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20)
}

async function aggregateTopProducts(dateStr, nextDateStr) {
  const { start, end } = dateRange(dateStr)
  const startISO = start.toISOString()
  const endISO = end.toISOString()

  const orders = await fetchAll('orders', {
    createdAt: _.gte(startISO).and(_.lt(endISO)),
    status: _.neq('cancelled'),
  }, { items: true })

  const map = {}
  for (const o of orders) {
    for (const item of (o.items || [])) {
      const pid = item.productId
      if (!pid) continue
      if (!map[pid]) {
        map[pid] = { productId: pid, productName: item.productName || '未知商品', views: 0, addToCarts: 0, orders: 0, revenue: 0 }
      }
      map[pid].orders++
      map[pid].revenue += (item.price || 0) * (item.quantity || 1)
    }
  }

  // 补充 views 和 addToCarts（从 tracking 事件）
  const trackingBatches = await fetchAll('tracking_events_batch', {
    createdAt: _.gte(startISO).and(_.lt(endISO)),
  })

  for (const batch of trackingBatches) {
    for (const evt of (batch.events || [])) {
      const pid = evt.properties?.productId
      if (!pid || !map[pid]) continue
      if (evt.eventType === 'product_view') map[pid].views++
      if (evt.eventType === 'add_to_cart') map[pid].addToCarts++
    }
  }

  return Object.values(map)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20)
}
