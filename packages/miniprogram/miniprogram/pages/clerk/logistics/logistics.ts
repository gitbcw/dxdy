const { GENERATED_ASSETS, getClerkOrderById, clerkShipOrder } = require('../../../services/index')

Page({
  data: {
    orderId: '',
    orderNo: '',
    orderType: '',
    returnId: '',
    originalOrderId: '',
    company: '',
    trackingNo: '',
    shipTime: '',
    status: '',
    packageType: '',
    coldChainMethod: '',
    packageWeight: '',
    boxTemperature: '',
    modifyReason: '',
    abnormalFlag: false,
    abnormalType: '',
    abnormalReason: '',
    abnormalTypes: [
      { value: 'partial', label: '部分发货' },
      { value: 'damaged', label: '商品破损' },
      { value: 'address_changed', label: '地址变更' },
      { value: 'near_expiry', label: '临期商品' },
      { value: 'other', label: '其他' },
    ],
    tracks: [] as any[],
    showEditPanel: false,
    selectedCompany: '',
    expressNo: '',
    expressCompanies: ['顺丰速运', '中通快递', '圆通速运', '韵达快递', '申通快递', '中国邮政'],
    packageTypes: ['冷藏箱', '保温箱', '普通箱'],
    coldChainMethods: ['冰袋（2-6°C）', '干冰', '常温'],
    coldChainImage: GENERATED_ASSETS.coldChain,
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
    const coldChain = shipping.coldChain || {}
    const tracks = this.buildTracks(order, shipping)
    const abnormal = shipping.abnormal || {}
    this.setData({
      orderNo: order.orderNo || order.id,
      orderType: order.type || 'normal',
      returnId: order.returnId || '',
      originalOrderId: order.originalOrderId || '',
      company: shipping.company || '',
      trackingNo: shipping.trackingNo || '',
      shipTime: shipping.shippedAt || '',
      status: order.rawStatus === 'pending_receipt' ? '配送中' : order.status === 'shipped' ? '已发货' : '待发货',
      packageType: coldChain.packageType || order.packageType || '',
      coldChainMethod: coldChain.method || order.coldChainMethod || '',
      packageWeight: coldChain.weight || order.packageWeight || '',
      boxTemperature: coldChain.boxTemperature || order.boxTemperature || '',
      modifyReason: '',
      abnormalFlag: !!abnormal.flagged,
      abnormalType: abnormal.type || '',
      abnormalReason: abnormal.reason || '',
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
      packageType: this.data.packageType || '冷藏箱',
      coldChainMethod: this.data.coldChainMethod || '冰袋（2-6°C）',
      packageWeight: this.data.packageWeight,
      boxTemperature: this.data.boxTemperature,
      modifyReason: '',
      abnormalFlag: false,
      abnormalType: '',
      abnormalReason: '',
    })
  },

  onSelectCompany(e: any) {
    this.setData({ selectedCompany: e.currentTarget.dataset.company })
  },

  onExpressNoInput(e: any) {
    this.setData({ expressNo: e.detail.value })
  },

  onPackageTypeTap(e: any) {
    this.setData({ packageType: e.currentTarget.dataset.value })
  },

  onColdChainTap(e: any) {
    this.setData({ coldChainMethod: e.currentTarget.dataset.value })
  },

  onColdFieldInput(e: any) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  onAbnormalToggle() {
    this.setData({ abnormalFlag: !this.data.abnormalFlag })
    if (!this.data.abnormalFlag) {
      this.setData({ abnormalType: '', abnormalReason: '' })
    }
  },

  onAbnormalTypeTap(e: any) {
    this.setData({ abnormalType: e.currentTarget.dataset.value })
  },

  onAbnormalReasonInput(e: any) {
    this.setData({ abnormalReason: e.detail.value })
  },

  onClosePanel() {
    this.setData({ showEditPanel: false })
  },

  async onSubmitEdit() {
    if (!this.data.selectedCompany || !this.data.expressNo) {
      wx.showToast({ title: '请填写完整物流信息', icon: 'none' })
      return
    }
    if (!this.data.modifyReason.trim()) {
      wx.showToast({ title: '请填写修改原因', icon: 'none' })
      return
    }
    if (!this.data.packageType || !this.data.coldChainMethod || !this.data.boxTemperature) {
      wx.showToast({ title: '请补全冷链信息', icon: 'none' })
      return
    }
    wx.showLoading({ title: '提交中...' })
    try {
      await clerkShipOrder({
        orderId: this.data.orderId,
        expressCompany: this.data.selectedCompany,
        expressNo: this.data.expressNo,
        packageType: this.data.packageType,
        coldChainMethod: this.data.coldChainMethod,
        packageWeight: this.data.packageWeight,
        boxTemperature: this.data.boxTemperature,
        modifyReason: this.data.modifyReason.trim(),
        abnormalFlag: this.data.abnormalFlag,
        abnormalType: this.data.abnormalType,
        abnormalReason: this.data.abnormalReason.trim(),
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
