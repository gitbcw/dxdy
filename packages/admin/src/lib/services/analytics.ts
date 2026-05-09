'use client'

import { getDb } from '@/lib/cloudbase'
import type { AnalyticsDaily, TopProduct, AgentContribution, OrderStatusDistribution, FunnelStep } from '@/lib/types-analytics'

function normalizeDoc<T extends Record<string, unknown>>(doc: T): T & { id: string } {
  const { _id, ...rest } = doc as any
  return { id: String(_id || ''), ...rest }
}

export async function fetchAnalyticsDaily(days = 30): Promise<AnalyticsDaily[]> {
  const db = getDb()
  if (!db) return []
  const { data } = await db.collection('analytics_daily')
    .orderBy('date', 'desc')
    .limit(days)
    .get()
  return (data || []).map(normalizeDoc)
}

export async function fetchOrderStatusDistribution(): Promise<OrderStatusDistribution[]> {
  const db = getDb()
  if (!db) return []
  const { data } = await db.collection('orders')
    .orderBy('createdAt', 'desc')
    .limit(500)
    .get()

  const statusLabel: Record<string, string> = {
    pending_payment: '待支付',
    pending_shipment: '待发货',
    pending_receipt: '待收货',
    completed: '已完成',
    cancelled: '已取消',
    pending_confirmation: '待确认',
    in_service: '服务中',
  }

  const grouped: Record<string, { count: number; amount: number }> = {}
  for (const order of data) {
    const s = order.status || 'unknown'
    if (!grouped[s]) grouped[s] = { count: 0, amount: 0 }
    grouped[s].count++
    grouped[s].amount += (order as any).pricing?.actualAmount || 0
  }

  return Object.entries(grouped).map(([status, { count, amount }]) => ({
    status,
    label: statusLabel[status] || status,
    count,
    amount,
  })).sort((a, b) => b.count - a.count)
}

export function computeFunnelData(dailyData: AnalyticsDaily[]): FunnelStep[] {
  const last7 = dailyData.slice(0, 7)
  const totals = {
    pageViews: last7.reduce((s, d) => s + (d.metrics?.pageViews || 0), 0),
    productViews: last7.reduce((s, d) => s + (d.metrics?.productViews || 0), 0),
    addToCarts: last7.reduce((s, d) => s + (d.metrics?.addToCarts || 0), 0),
    orderSubmits: last7.reduce((s, d) => s + (d.metrics?.orderSubmits || 0), 0),
    orderPayments: last7.reduce((s, d) => s + (d.metrics?.orderPayments || 0), 0),
  }

  return [
    { label: '页面浏览', count: totals.pageViews, rate: 1 },
    { label: '商品详情', count: totals.productViews, rate: totals.pageViews ? totals.productViews / totals.pageViews : 0 },
    { label: '加入购物车', count: totals.addToCarts, rate: totals.productViews ? totals.addToCarts / totals.productViews : 0 },
    { label: '提交订单', count: totals.orderSubmits, rate: totals.addToCarts ? totals.orderSubmits / totals.addToCarts : 0 },
    { label: '支付成功', count: totals.orderPayments, rate: totals.orderSubmits ? totals.orderPayments / totals.orderSubmits : 0 },
  ]
}

export function getTopProducts(dailyData: AnalyticsDaily[], limit = 10): TopProduct[] {
  const merged: Record<string, TopProduct> = {}
  for (const day of dailyData.slice(0, 7)) {
    for (const p of day.topProducts || []) {
      if (!merged[p.productId]) {
        merged[p.productId] = { ...p }
      } else {
        merged[p.productId].views += p.views
        merged[p.productId].addToCarts += p.addToCarts
        merged[p.productId].orders += p.orders
        merged[p.productId].revenue += p.revenue
      }
    }
  }
  return Object.values(merged).sort((a, b) => b.revenue - a.revenue).slice(0, limit)
}

export function getAgentContribution(dailyData: AnalyticsDaily[], limit = 10): AgentContribution[] {
  const merged: Record<string, AgentContribution> = {}
  for (const day of dailyData.slice(0, 7)) {
    for (const a of day.agentContribution || []) {
      if (!merged[a.salespersonId]) {
        merged[a.salespersonId] = { ...a }
      } else {
        merged[a.salespersonId].orderCount += a.orderCount
        merged[a.salespersonId].revenue += a.revenue
        merged[a.salespersonId].commission += a.commission
      }
    }
  }
  return Object.values(merged).sort((a, b) => b.revenue - a.revenue).slice(0, limit)
}
