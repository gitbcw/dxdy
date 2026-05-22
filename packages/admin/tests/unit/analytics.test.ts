import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computeFunnelData, getAgentContribution, getTopProducts } from '../../src/lib/services/analytics'

const { callFunctionMock } = vi.hoisted(() => ({
  callFunctionMock: vi.fn(),
}))

vi.mock('../../src/lib/cloudbase', () => ({
  callFunction: callFunctionMock,
  getStoredAdminToken: () => 'token',
}))

const daily = [
  {
    id: 'd1',
    date: '2026-05-21',
    metrics: {
      revenue: 100,
      orderCount: 2,
      avgOrderValue: 50,
      newCustomers: 1,
      activeCustomers: 2,
      repeatCustomers: 1,
      pageViews: 100,
      productViews: 60,
      addToCarts: 20,
      orderSubmits: 10,
      orderPayments: 6,
      refundAmount: 0,
      refundCount: 0,
    },
    topProducts: [
      { productId: 'p1', productName: 'A', views: 10, addToCarts: 4, orders: 2, revenue: 40 },
      { productId: 'p2', productName: 'B', views: 5, addToCarts: 1, orders: 1, revenue: 20 },
    ],
    agentContribution: [
      { salespersonId: 's1', salespersonName: 'X', orderCount: 1, revenue: 60, commission: 12 },
    ],
    byCustomerType: {
      institution: { revenue: 60, orderCount: 1, newCustomers: 1 },
      personal: { revenue: 40, orderCount: 1, newCustomers: 0 },
    },
    createdAt: '2026-05-21 00:00',
  },
  {
    id: 'd2',
    date: '2026-05-20',
    metrics: {
      revenue: 200,
      orderCount: 4,
      avgOrderValue: 50,
      newCustomers: 2,
      activeCustomers: 3,
      repeatCustomers: 1,
      pageViews: 200,
      productViews: 100,
      addToCarts: 40,
      orderSubmits: 20,
      orderPayments: 12,
      refundAmount: 0,
      refundCount: 1,
    },
    topProducts: [
      { productId: 'p1', productName: 'A', views: 20, addToCarts: 6, orders: 3, revenue: 60 },
    ],
    agentContribution: [
      { salespersonId: 's1', salespersonName: 'X', orderCount: 2, revenue: 100, commission: 20 },
      { salespersonId: 's2', salespersonName: 'Y', orderCount: 1, revenue: 50, commission: 10 },
    ],
    byCustomerType: {
      institution: { revenue: 120, orderCount: 2, newCustomers: 1 },
      personal: { revenue: 80, orderCount: 2, newCustomers: 1 },
    },
    createdAt: '2026-05-20 00:00',
  },
] as any[]

beforeEach(() => {
  callFunctionMock.mockReset()
})

describe('analytics helpers', () => {
  it('builds funnel data', () => {
    const funnel = computeFunnelData(daily)
    expect(funnel[0]).toMatchObject({ label: expect.any(String), count: 300, rate: 1 })
    expect(funnel[4]).toMatchObject({ label: expect.any(String), count: 18 })
  })

  it('merges top products', () => {
    expect(getTopProducts(daily, 10)).toEqual([
      { productId: 'p1', productName: 'A', views: 30, addToCarts: 10, orders: 5, revenue: 100 },
      { productId: 'p2', productName: 'B', views: 5, addToCarts: 1, orders: 1, revenue: 20 },
    ])
  })

  it('merges agent contribution', () => {
    expect(getAgentContribution(daily, 10)).toEqual([
      { salespersonId: 's1', salespersonName: 'X', orderCount: 3, revenue: 160, commission: 32 },
      { salespersonId: 's2', salespersonName: 'Y', orderCount: 1, revenue: 50, commission: 10 },
    ])
  })

  it('fetches analytics and order distributions from the database', async () => {
    const collections: Record<string, any[]> = {
      analytics_daily: [{ _id: 'd1', date: '2026-05-21', metrics: { pageViews: 1 } }],
      orders: [
        { _id: 'o1', status: 'completed', pricing: { actualAmount: 100 } },
        { _id: 'o2', status: 'completed', pricing: { actualAmount: 50 } },
        { _id: 'o3', status: 'pending_payment', pricing: { actualAmount: 20 } },
      ],
    }

    callFunctionMock.mockImplementation(async (_name: string, payload: any) => {
      return {
        success: true,
        data: (collections[payload.collection] || []).slice(0, payload.limit || 500),
      }
    })

    const { fetchAnalyticsDaily, fetchOrderStatusDistribution } = await import('../../src/lib/services/analytics')
    expect(await fetchAnalyticsDaily(1)).toEqual([
      { id: 'd1', date: '2026-05-21', metrics: { pageViews: 1 } },
    ])
    expect(await fetchOrderStatusDistribution()).toEqual([
      expect.objectContaining({ status: 'completed', count: 2, amount: 150 }),
      expect.objectContaining({ status: 'pending_payment', count: 1, amount: 20 }),
    ])
  })
})
