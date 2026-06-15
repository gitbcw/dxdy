const {
  createInvoice,
  getInvoiceByOrderId,
  getOrderById,
  getOrders,
  formatMoney,
} = require('../../../services/index')

function getOrderProductNames(order: any) {
  const names = (order.items || [])
    .map((item: any) => item.productName || item.name || '')
    .filter(Boolean)
  if (!names.length) return '订单商品'
  if (names.length === 1) return names[0]
  return `${names[0]}等${names.length}件商品`
}

function mapInvoiceOrder(order: any) {
  const productNames = getOrderProductNames(order)
  return {
    ...order,
    productNames,
    amountText: formatMoney(order.pricing?.actualAmount || 0),
  }
}

function isInvoiceEligibleOrder(order: any) {
  return order?.type !== 'recharge' && order?.payment?.status === 'paid'
}

Page({
  data: {
    invoiceType: 'electronic',
    title: '',
    taxNo: '',
    email: '',
    orderId: '',
    orderNo: '',
    orderProductNames: '',
    orderOptions: [] as any[],
    showOrderPanel: false,
    loadingOrders: false,
    amount: '0.00',
    statusText: '',
    orderLocked: false,
    remark: '',
    submitting: false,
  },

  onLoad(options: any) {
    if (options.orderId) {
      this.loadOrder(options.orderId)
    } else {
      this.loadCompletedOrders()
    }
  },

  async loadOrder(orderId: string) {
    const order = await getOrderById(orderId)
    if (!order) {
      wx.showToast({ title: '订单不存在', icon: 'none' })
      return
    }
    if (!isInvoiceEligibleOrder(order)) {
      wx.showToast({ title: '充值订单无需申请发票', icon: 'none' })
      return
    }
    const invoice = await getInvoiceByOrderId(order.id)
    const mapped = mapInvoiceOrder(order)
    this.setData({
      orderId: mapped.id,
      orderNo: mapped.orderNo,
      orderProductNames: mapped.productNames,
      amount: mapped.amountText,
      statusText: invoice ? '该订单已提交开票申请' : '',
      orderLocked: true,
    })
  },

  async loadCompletedOrders() {
    this.setData({ loadingOrders: true })
    try {
      const orders = await getOrders({ status: 'completed' })
      const orderOptions = (orders || [])
        .filter(isInvoiceEligibleOrder)
        .map(mapInvoiceOrder)
      this.setData({ orderOptions, loadingOrders: false })
    } catch (e: any) {
      this.setData({ orderOptions: [], loadingOrders: false })
      wx.showToast({ title: e?.message || '订单读取失败', icon: 'none' })
    }
  },

  onInput(e: any) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  onOpenOrderPanel() {
    if (this.data.orderLocked) return
    if (!this.data.orderOptions.length && !this.data.loadingOrders) {
      this.loadCompletedOrders()
    }
    this.setData({ showOrderPanel: true })
  },

  onCloseOrderPanel() {
    this.setData({ showOrderPanel: false })
  },

  async onSelectOrder(e: any) {
    const id = e.currentTarget.dataset.id
    const order = this.data.orderOptions.find((item: any) => item.id === id)
    if (!order) return
    const invoice = await getInvoiceByOrderId(order.id)
    this.setData({
      orderId: order.id,
      orderNo: order.orderNo,
      orderProductNames: order.productNames,
      amount: order.amountText,
      statusText: invoice ? '该订单已提交开票申请' : '',
      showOrderPanel: false,
    })
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
    const orderId = this.data.orderId
    if (!orderId) {
      wx.hideLoading()
      this.setData({ submitting: false })
      wx.showToast({ title: '请选择已完成订单', icon: 'none' })
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
