const icons = require('../../../services/icons')
const { getClerkOrders } = require('../../../services/index')

Page({
  data: {
    activeTab: 'pending',
    orders: [],
    isEmpty: false,
    iconClock: icons.clock,
    iconRefresh: icons.refresh,
    iconEmpty: icons.emptyOrder,
    tabs: [
      { key: 'pending', label: '待发货' },
      { key: 'shipped', label: '已发货' },
      { key: 'all', label: '全部' },
    ],
  },

  onShow() {
    this.loadOrders()
  },

  onTabChange(e: any) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    this.loadOrders()
  },

  async loadOrders() {
    const status = this.data.activeTab === 'all' ? undefined : this.data.activeTab
    const orders = await getClerkOrders({ status })
    this.setData({
      orders,
      isEmpty: orders.length === 0,
    })
  },

  onOrderTap(e: any) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/clerk/order-detail/order-detail?id=${id}` })
  },
})

export {}
