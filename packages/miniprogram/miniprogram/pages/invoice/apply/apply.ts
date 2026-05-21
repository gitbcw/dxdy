const {
  createInvoice,
  getInvoiceByOrderId,
  getOrderById,
  getOrderByNo,
  formatMoney,
} = require('../../../services/index')

Page({
  data: {
    invoiceType: 'electronic',
    title: '',
    taxNo: '',
    email: '',
    orderId: '',
    orderNo: '',
    amount: '0.00',
    statusText: '',
    orderLocked: false,
    remark: '',
    submitting: false,
  },

  onLoad(options: any) {
    if (options.orderId) {
      this.loadOrder(options.orderId)
    }
  },

  async loadOrder(orderId: string) {
    const order = await getOrderById(orderId)
    if (!order) {
      wx.showToast({ title: '订单不存在', icon: 'none' })
      return
    }
    const invoice = await getInvoiceByOrderId(order.id)
    this.setData({
      orderId: order.id,
      orderNo: order.orderNo,
      amount: formatMoney(order.pricing?.actualAmount || 0),
      statusText: invoice ? '该订单已提交开票申请' : '',
      orderLocked: true,
    })
  },

  onInput(e: any) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  async resolveOrder() {
    if (this.data.orderId) return this.data.orderId
    const orderNo = this.data.orderNo.trim()
    if (!orderNo) return ''
    const order = await getOrderByNo(orderNo)
    if (!order) return ''
    this.setData({
      orderId: order.id,
      orderNo: order.orderNo,
      amount: formatMoney(order.pricing?.actualAmount || 0),
    })
    return order.id
  },

  async onSubmit() {
    if (this.data.submitting) return
    const user = getApp().globalData.userInfo
    if (!user) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    if (!this.data.title.trim()) {
      wx.showToast({ title: '请填写发票抬头', icon: 'none' })
      return
    }
    if (!this.data.email.trim()) {
      wx.showToast({ title: '请填写接收邮箱', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...' })
    const orderId = await this.resolveOrder()
    if (!orderId) {
      wx.hideLoading()
      this.setData({ submitting: false })
      wx.showToast({ title: '请填写有效订单号', icon: 'none' })
      return
    }

    const result = await createInvoice({
      customerId: user.id,
      orderId,
      invoiceType: 'electronic',
      title: this.data.title.trim(),
      taxNo: this.data.taxNo.trim(),
      email: this.data.email.trim(),
      remark: this.data.remark.trim(),
    })
    wx.hideLoading()
    this.setData({ submitting: false })

    if (!result.success) {
      wx.showToast({ title: result.error || '提交失败', icon: 'none' })
      return
    }

    this.setData({ statusText: '开票申请已提交，等待后台处理' })
    wx.showToast({ title: '申请已提交', icon: 'success' })
  },
})

export {}
