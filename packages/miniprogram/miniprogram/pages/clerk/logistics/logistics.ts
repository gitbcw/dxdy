const { getClerkOrderById, clerkShipOrder } = require('../../../services/index')

Page({
  data: {
    orderId: '',
    orderNo: '',
    company: '',
    trackingNo: '',
    shipTime: '',
    status: '',
    recipient: '',
    phone: '',
    address: '',
    tracks: [] as any[],
    showEditPanel: false,
    selectedCompany: '',
    expressNo: '',
    expressCompanies: ['顺丰速运', '中通快递', '圆通速运', '韵达快递', '申通快递', '中国邮政'],
  },

  onLoad(options: any) {
    if (options.orderId) {
      this.setData({ orderId: options.orderId })
      this.loadOrder(options.orderId)
    }
  },

  async loadOrder(id: string) {
    const order = await getClerkOrderById(id)
    if (!order) {
      wx.showToast({ title: '订单不存在', icon: 'none' })
      return
    }
    const shipping = order.shipping || {}
    const addr = shipping.address || order.shippingAddress || {}

    const tracks = this.buildTracks(order, shipping)
    this.setData({
      orderNo: order.orderNo || order.id,
      company: shipping.company || '',
      trackingNo: shipping.trackingNo || '',
      shipTime: shipping.shippedAt || '',
      status: order.rawStatus === 'pending_receipt' ? '配送中' : order.status === 'shipped' ? '已发货' : '待发货',
      recipient: addr.recipient || order.customerName || '',
      phone: addr.phone || order.customerPhone || '',
      address: [addr.province, addr.city, addr.district, addr.detail].filter(Boolean).join('') || order.address || '',
      tracks,
    })
  },

  buildTracks(order: any, shipping: any) {
    const logistics = (shipping.logistics || []).map((item: any) => ({
      title: item.title || item.description || '物流更新',
      time: item.time || shipping.shippedAt || order.updatedAt,
      desc: item.description || item.location || '',
      active: true,
    }))
    if (shipping.shippedAt) {
      logistics.unshift({
        title: '已发货',
        time: shipping.shippedAt,
        desc: `${shipping.company || ''} ${shipping.trackingNo || ''}`,
        active: true,
      })
    }
    return logistics.reverse()
  },

  onCopyTrackingNo() {
    if (!this.data.trackingNo) return
    wx.setClipboardData({
      data: this.data.trackingNo,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    })
  },

  onShowEdit() {
    this.setData({
      showEditPanel: true,
      selectedCompany: this.data.company,
      expressNo: this.data.trackingNo,
    })
  },

  onSelectCompany(e: any) {
    this.setData({ selectedCompany: e.currentTarget.dataset.company })
  },

  onExpressNoInput(e: any) {
    this.setData({ expressNo: e.detail.value })
  },

  onClosePanel() {
    this.setData({ showEditPanel: false })
  },

  async onSubmitEdit() {
    if (!this.data.selectedCompany || !this.data.expressNo) {
      wx.showToast({ title: '请填写完整物流信息', icon: 'none' })
      return
    }
    wx.showLoading({ title: '提交中...' })
    try {
      await clerkShipOrder({
        orderId: this.data.orderId,
        expressCompany: this.data.selectedCompany,
        expressNo: this.data.expressNo,
      })
      wx.hideLoading()
      wx.showToast({ title: '修改成功' })
      this.setData({ showEditPanel: false })
      this.loadOrder(this.data.orderId)
    } catch (e: any) {
      wx.hideLoading()
      wx.showToast({ title: e?.message || '修改失败', icon: 'none' })
    }
  },

  navigateBack() {
    wx.navigateBack({ delta: 1 })
  },
})

export {}
