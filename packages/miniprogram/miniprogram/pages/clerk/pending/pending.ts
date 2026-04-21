const icons = require('../../../services/icons')
const { getClerkOrders, getOrderStatusText } = require('../../../services/index')

Page({
  data: {
    orders: [] as any[],
    isEmpty: false,
    pendingCount: 0,
    summaryCards: [] as any[],
    iconClock: icons.clock,
    iconExchange: icons.refresh,
  },

  onShow() {
    this.loadOrders()
  },

  async loadOrders() {
    const orders = await getClerkOrders({ status: 'pending' })
    const mappedOrders = orders.map((order: any, index: number) => ({
      ...order,
      statusText: getOrderStatusText(order.status),
      badgeText: order.type === 'exchange' ? '换货优先' : index === 0 ? '当前最急' : '待发货',
      helperText: order.type === 'exchange'
        ? '关联原订单，优先补发避免客户等待'
        : '录入物流后客户可立即看到配送状态',
    }))

    this.setData({
      orders: mappedOrders,
      isEmpty: mappedOrders.length === 0,
      pendingCount: mappedOrders.length,
      summaryCards: [
        { value: String(mappedOrders.length), label: '待发货', desc: '当前仍需处理的任务' },
        { value: String(mappedOrders.filter((item: any) => item.type === 'exchange').length), label: '换货单', desc: '建议优先处理' },
        { value: '实时', label: '物流同步', desc: '录单号后客户可见' },
      ],
    })
  },

  onOrderTap(e: any) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/clerk/order-detail/order-detail?id=${id}` })
  },
})

export {}
