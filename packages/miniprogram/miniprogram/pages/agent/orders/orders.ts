const { getAgentOrders, formatMoney, getOrderStatusText } = require('../../../services/index')

Page({
  data: {
    orders: [] as any[],
    visibleOrders: [] as any[],
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'pending_payment', label: '待付款' },
      { key: 'pending_shipment', label: '待发货' },
      { key: 'pending_receipt', label: '配送中' },
      { key: 'completed', label: '已完成' },
    ],
    activeTab: 'all',
    summaryCards: [] as any[],
    customerId: '',
    isEmpty: false,
  },

  onLoad(e: any) {
    this.setData({ customerId: e.customerId || '' })
  },

  onShow() {
    this.loadOrders()
  },

  async loadOrders() {
    const orders = await getAgentOrders({ customerId: this.data.customerId })
    const mapped = orders.map((order: any) => this.mapOrder(order))
    this.setData({
      orders: mapped,
      visibleOrders: this.filterOrders(mapped, this.data.activeTab),
      summaryCards: this.getSummaryCards(mapped),
      isEmpty: mapped.length === 0,
    })
  },

  mapOrder(order: any) {
    const firstItem = order.items?.[0] || {}
    const amount = order.pricing?.actualAmount || 0
    const commission = order.commission || {}
    return {
      ...order,
      statusText: getOrderStatusText(order.status),
      amountText: formatMoney(amount),
      commissionText: `${this.getCommissionStatusText(commission.status)} ¥${formatMoney(commission.amount || 0)}`,
      itemText: `${firstItem.productName || '订单商品'} · ${firstItem.spec || ''}`,
      itemCount: (order.items || []).reduce((sum: number, item: any) => sum + (item.quantity || 0), 0),
      customerTypeText: order.customerType === 'institution' ? '医院' : '个人',
      returnText: order.returnRecord ? '售后中' : '',
      dateText: order.createdAt || '',
    }
  },

  getCommissionStatusText(status: string) {
    const map: Record<string, string> = {
      pending: '待核算',
      locked: '冻结中',
      settled: '已入账',
      adjusted: '已调整',
      deducted: '已扣减',
    }
    return map[status] || '同步中'
  },

  getSummaryCards(orders: any[]) {
    const totalAmount = orders.reduce((sum: number, order: any) => sum + (order.pricing?.actualAmount || 0), 0)
    const commissionAmount = orders.reduce((sum: number, order: any) => sum + (order.commission?.amount || 0), 0)
    return [
      { value: String(orders.length), label: '客户订单' },
      { value: `¥${formatMoney(totalAmount)}`, label: '订单金额' },
      { value: `¥${formatMoney(commissionAmount)}`, label: '预计提成' },
    ]
  },

  filterOrders(orders: any[], key: string) {
    if (key === 'all') return orders
    return orders.filter((order: any) => order.status === key)
  },

  onTabTap(e: any) {
    const activeTab = e.currentTarget.dataset.key
    const visibleOrders = this.filterOrders(this.data.orders, activeTab)
    this.setData({ activeTab, visibleOrders, isEmpty: visibleOrders.length === 0 })
  },

  onOrderTap(e: any) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/orders/order-detail/order-detail?id=${id}` })
  },

  onCustomerTap(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/agent/customer-detail/customer-detail?id=${id}` })
  },
})

export {}
