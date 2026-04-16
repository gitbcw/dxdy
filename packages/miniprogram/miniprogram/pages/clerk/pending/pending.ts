const icons = require('../../../services/icons')
const { getClerkOrders } = require('../../../services/index')

Page({
  data: {
    orders: [] as any[],
    isEmpty: false,
    pendingCount: 0,
    iconClock: icons.clock,
    iconExchange: icons.refresh,
  },

  onShow() {
    this.loadOrders()
  },

  async loadOrders() {
    const orders = await getClerkOrders({ status: 'pending' })
    this.setData({
      orders,
      isEmpty: orders.length === 0,
      pendingCount: orders.length,
    })
  },

  onOrderTap(e: any) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/clerk/order-detail/order-detail?id=${id}` })
  },
})
