const { getAgentCustomerDetail, formatMoney, getOrderStatusText, maskPhone } = require('../../../services/index')

Page({
  data: {
    loading: true,
    customer: null as any,
    stats: null as any,
    recentOrders: [] as any[],
    phoneText: '',
    typeText: '',
    verifyText: '',
    trendBars: [] as any[],
  },

  onLoad(e: any) {
    if (e.id) this.loadDetail(e.id)
  },

  async loadDetail(id: string) {
    const detail = await getAgentCustomerDetail(id)
    if (!detail) {
      this.setData({ loading: false })
      wx.showToast({ title: '客户不存在或无权限', icon: 'none' })
      return
    }
    const customer = detail.customer
    const recentOrders = detail.orders.slice(0, 5).map((order: any) => ({
      ...order,
      amountText: formatMoney(order.pricing?.actualAmount || 0),
      statusText: getOrderStatusText(order.status),
    }))
    const trendBars = this.buildTrendBars(detail.orders)
    this.setData({
      loading: false,
      customer,
      stats: {
        ...detail.stats,
        totalAmountText: formatMoney(detail.stats.totalAmount),
        monthAmountText: formatMoney(detail.stats.monthAmount),
        commissionAmountText: formatMoney(detail.stats.commissionAmount),
      },
      recentOrders,
      phoneText: maskPhone(customer.phone || ''),
      typeText: customer.type === 'institution' ? '机构客户' : '个人客户',
      verifyText: customer.verificationStatus === 'approved' ? '已认证' : customer.verificationStatus === 'pending' ? '认证中' : '未认证',
      trendBars,
    })
  },

  buildTrendBars(orders: any[]) {
    const sorted = orders
      .slice()
      .sort((a: any, b: any) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
      .slice(-6)
    const maxAmount = Math.max(1, ...sorted.map((order: any) => Number(order.pricing?.actualAmount || 0)))
    return sorted.map((order: any) => {
      const amount = Number(order.pricing?.actualAmount || 0)
      const label = String(order.createdAt || order.dateText || '').slice(5, 10) || '订单'
      return {
        id: order.id,
        label,
        amountText: formatMoney(amount),
        height: Math.max(18, Math.round((amount / maxAmount) * 120)),
      }
    })
  },

  onCallTap() {
    const phone = this.data.customer?.phone
    if (!phone) {
      wx.showToast({ title: '暂无联系电话', icon: 'none' })
      return
    }
    wx.makePhoneCall({ phoneNumber: phone })
  },

  onOrdersTap() {
    wx.navigateTo({ url: `/pages/agent/orders/orders?customerId=${this.data.customer.id}` })
  },
})

export {}
