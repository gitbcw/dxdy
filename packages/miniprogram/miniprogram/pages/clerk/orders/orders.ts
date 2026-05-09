const icons = require('../../../services/icons')
const { getClerkOrders } = require('../../../services/index')

Page({
  data: {
    activeTab: 'pending',
    searchKeyword: '',
    orders: [],
    isEmpty: false,
    iconClock: icons.clock,
    iconRefresh: icons.refresh,
    iconEmpty: icons.emptyOrder,
    tabs: [
      { key: 'pending', label: '待发货' },
      { key: 'today_shipped', label: '今日发货' },
      { key: 'shipped', label: '配送中' },
      { key: 'signed', label: '已签收' },
      { key: 'all', label: '全部' },
    ],
  },

  onLoad(options: any) {
    if (options?.tab) {
      this.setData({ activeTab: options.tab })
    }
    if (options?.keyword) {
      this.setData({ searchKeyword: decodeURIComponent(options.keyword) })
    }
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
    const keyword = (this.data.searchKeyword || '').trim().toLowerCase()
    const orders = await getClerkOrders({ status })
    const filteredOrders = keyword
      ? orders.filter((order: any) => {
        const productText = (order.items || [])
          .map((item: any) => `${item.name || item.productName || ''} ${item.specs || item.spec || ''}`)
          .join(' ')
          .toLowerCase()
        return [
          order.orderNo,
          order.id,
          order.customerName,
          order.customerPhone,
          order.address,
          productText,
        ].some((value) => String(value || '').toLowerCase().includes(keyword))
      })
      : orders
    this.setData({
      orders: filteredOrders,
      isEmpty: filteredOrders.length === 0,
    })
  },

  onOrderTap(e: any) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/clerk/order-detail/order-detail?id=${id}` })
  },
})

export {}
