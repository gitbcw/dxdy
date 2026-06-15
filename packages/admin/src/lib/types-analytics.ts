export interface AnalyticsDaily {
  id: string
  date: string
  metrics: {
    revenue: number
    orderCount: number
    avgOrderValue: number
    newCustomers: number
    activeCustomers: number
    repeatCustomers: number
    pageViews: number
    productViews: number
    addToCarts: number
    orderSubmits: number
    orderPayments: number
    refundAmount: number
    refundCount: number
  }
  topProducts: TopProduct[]
  agentContribution: AgentContribution[]
  byCustomerType: {
    institution: { revenue: number; orderCount: number; newCustomers: number }
  }
  createdAt: string
}

export interface TopProduct {
  productId: string
  productName: string
  views: number
  addToCarts: number
  orders: number
  revenue: number
}

export interface AgentContribution {
  salespersonId: string
  salespersonName: string
  orderCount: number
  revenue: number
  commission: number
}

export interface FunnelStep {
  label: string
  count: number
  rate: number  // conversion rate from previous step
}

export interface OrderStatusDistribution {
  status: string
  label: string
  count: number
  amount: number
}
