const { getOrders, formatMoney, formatDateTime } = require('../../../services/index')

const statusLabel: Record<string, string> = {
  pending_payment: '待付款',
  pending_shipment: '待发货',
  pending_receipt: '待收货',
  completed: '已完成',
  cancelled: '已取消',
}

Page({
  data: {
    orders: [] as any[],
    isEmpty: false,
  },

  onShow() {
    this.loadOrders()
  },

  async loadOrders() {
    const user = getApp().globalData.userInfo
    if (!user) {
      this.setData({ isEmpty: true })
      return
    }
    const orders = await getOrders({ customerId: user.id })
    this.setData({ orders, isEmpty: orders.length === 0 })
  },

  onOrderTap(e: any) {
    const id = e.currentTarget.dataset.id
    // 简化：直接显示详情
    const order = this.data.orders.find((o: any) => o.id === id)
    if (order) {
      const info = `订单号: ${order.id}\n状态: ${statusLabel[order.status]}\n金额: ¥${formatMoney(order.pricing.actualAmount)}\n时间: ${formatDateTime(order.createdAt)}`
      wx.showModal({ title: '订单详情', content: info, showCancel: false })
    }
  },
})
