const { getOrderById, createReturn, formatMoney, getProductVisualImage } = require('../../../services/index')

Page({
  data: {
    orderId: '',
    order: null as any,
    firstItem: null as any,
    serviceType: 'refund_return',
    reason: '产品破损/泄漏',
    description: '',
    refundAmount: '0.00',
    productImageUrl: '',
    vouchers: [] as string[],
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
    const firstItem = order.items?.[0] || {}
    this.setData({
      orderId,
      order,
      firstItem,
      refundAmount: formatMoney(order.pricing?.actualAmount || firstItem.totalPrice || 0),
      productImageUrl: firstItem.productImage || getProductVisualImage(firstItem.productName),
    })
  },

  onTypeTap(e: any) {
    this.setData({ serviceType: e.currentTarget.dataset.type })
  },

  onReasonInput(e: any) {
    this.setData({ reason: e.detail.value })
  },

  onDescriptionInput(e: any) {
    this.setData({ description: e.detail.value })
  },

  onUpload() {
    wx.chooseMedia({
      count: 3,
      mediaType: ['image'],
      success: (res: any) => {
        this.setData({ vouchers: res.tempFiles.map((item: any) => item.tempFilePath) })
      },
    })
  },

  async onSubmit() {
    const { order, firstItem, reason, description } = this.data
    if (!order || !firstItem) {
      wx.showToast({ title: '缺少订单信息', icon: 'none' })
      return
    }
    if (!reason.trim()) {
      wx.showToast({ title: '请填写售后原因', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '提交中...' })
      const record = await createReturn({
        orderId: order.id,
        customerId: order.customerId,
        type: this.data.serviceType,
        reason: reason.trim(),
        description: description.trim(),
        vouchers: this.data.vouchers,
        refundAmount: order.pricing?.actualAmount || firstItem.totalPrice || 0,
        items: order.items.map((item: any) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          spec: item.spec,
        })),
      })
      wx.hideLoading()
      wx.showToast({ title: '申请已提交', icon: 'success' })
      setTimeout(() => wx.redirectTo({ url: `/pages/returns/detail/detail?id=${record.id}` }), 600)
    } catch (err: any) {
      wx.hideLoading()
      wx.showToast({ title: err?.message || '提交失败', icon: 'none' })
    }
  },
})

export {}
