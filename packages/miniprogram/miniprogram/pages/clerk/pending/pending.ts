const icons = require('../../../services/icons')
const { getClerkOrders, getOrderStatusText, getProductVisualImage } = require('../../../services/index')

Page({
  data: {
    orders: [] as any[],
    isEmpty: false,
    pendingCount: 0,
    urgentCount: 0,
    preparingCount: 0,
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
      items: (order.items || []).map((item: any) => ({
        ...item,
        imageUrl: item.productImage || getProductVisualImage(item.name || item.productName),
      })),
      statusText: getOrderStatusText(order.rawStatus),
      badgeText: order.type === 'exchange' ? '换货优先' : order.status === 'preparing' ? '备货中' : index === 0 ? '当前最急' : '待发货',
      helperText: order.type === 'exchange'
        ? '关联原订单，优先补发避免客户等待'
        : order.status === 'preparing'
        ? '正在备货，完成后请录入物流发货'
        : '录入物流后客户可立即看到配送状态',
    }))

    this.setData({
      orders: mappedOrders,
      isEmpty: mappedOrders.length === 0,
      pendingCount: mappedOrders.length,
      urgentCount: mappedOrders.filter((item: any) => item.type === 'exchange').length,
      preparingCount: mappedOrders.filter((item: any) => item.status === 'preparing').length,
      summaryCards: [
        { value: String(mappedOrders.length), label: '待发货' },
        { value: String(mappedOrders.filter((item: any) => item.type === 'exchange').length), label: '换货单' },
        { value: String(mappedOrders.filter((item: any) => item.status === 'preparing').length), label: '备货中' },
      ],
    })
  },

  onOrderTap(e: any) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/clerk/order-detail/order-detail?id=${id}` })
  },
})

export {}
