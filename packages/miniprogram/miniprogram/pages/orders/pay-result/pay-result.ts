const { getOrderById, formatMoney, formatDateTime } = require('../../../services/index')

Page({
  data: {
    orderId: '',
    orderNo: 'DD20240530000123',
    amount: '300.00',
    orderType: '普通订单',
    bookingTime: '--',
    payTime: '2024-05-30 10:32:22',
    payMethod: '微信支付',
  },

  onLoad(options: any) {
    if (options.id) {
      this.loadOrder(options.id)
      return
    }
    this.setData({
      orderId: options.orderId || '',
      orderNo: options.orderNo || this.data.orderNo,
      amount: options.amount || this.data.amount,
      orderType: options.type || this.data.orderType,
      bookingTime: options.bookingTime || this.data.bookingTime,
    })
  },

  async loadOrder(id: string) {
    const order = await getOrderById(id)
    if (!order) {
      wx.showToast({ title: '订单不存在', icon: 'none' })
      return
    }
    const payment = order.payment || {}
    this.setData({
      orderId: id,
      orderNo: order.orderNo || id,
      amount: formatMoney(order.pricing?.actualAmount || 0),
      orderType: order.type === 'booking' ? '预约订单' : '普通订单',
      bookingTime: order.booking?.date || '--',
      payTime: payment.paidAt || formatDateTime(new Date()),
      payMethod: payment.method === 'wallet' ? '钱包余额' : '微信支付',
    })
  },

  onViewOrder() {
    wx.redirectTo({ url: `/pages/orders/order-detail/order-detail?id=${this.data.orderId || this.data.orderNo}` })
  },

  onBackHome() {
    wx.switchTab({ url: '/pages/home/home' })
  },
})

export {}
