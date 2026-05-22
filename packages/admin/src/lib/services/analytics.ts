'use client'

import { callFunction, getStoredAdminToken } from '@/lib/cloudbase'
import type { AnalyticsDaily, TopProduct, AgentContribution, OrderStatusDistribution, FunnelStep } from '@/lib/types-analytics'

type CloudFunctionResult<T = unknown> = { success?: boolean; error?: string; data?: T }

function normalizeDoc<T extends Record<string, unknown>>(doc: T): T & { id: string } {
  const { _id, ...rest } = doc as Record<string, unknown>
  return { id: String(_id || ''), ...rest } as T & { id: string }
}

async function adminData<T>(payload: Record<string, unknown>): Promise<T> {
  const result = await callFunction<CloudFunctionResult<T>>('adminData', {
    token: getStoredAdminToken(),
    ...payload,
  })
  if (!result.success) throw new Error(result.error || '分析数据加载失败')
  return result.data as T
}

export async function fetchAnalyticsDaily(days = 30): Promise<AnalyticsDaily[]> {
  const data = await adminData<unknown[]>({
    action: 'list',
    collection: 'analytics_daily',
    limit: days,
    orderBy: { field: 'date', direction: 'desc' },
  })
  return (Array.isArray(data) ? data : [])
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
    .map(normalizeDoc) as unknown as AnalyticsDaily[]
}

export async function fetchOrderStatusDistribution(): Promise<OrderStatusDistribution[]> {
  const data = await adminData<unknown[]>({
    action: 'list',
    collection: 'orders',
    limit: 500,
    orderBy: { field: 'createdAt', direction: 'desc' },
  })

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
  for (const order of Array.isArray(data) ? data : []) {
    if (!order || typeof order !== 'object') continue
    const current = order as Record<string, unknown>
    const s = String(current.status || 'unknown')
    if (!grouped[s]) grouped[s] = { count: 0, amount: 0 }
    grouped[s].count += 1
    grouped[s].amount += Number((current.pricing as Record<string, unknown> | undefined)?.actualAmount || 0)
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
