const icons = require('../../../services/icons')
const { getClerkOrderById, clerkShipOrder, markOrderPreparing, getProductVisualImage } = require('../../../services/index')

Page({
  data: {
    order: null as any,
    showExpressPanel: false,
    selectedCompany: '',
    expressNo: '',
    packageType: '冷藏箱',
    coldChainMethod: '冰袋（2-6°C）',
    packageWeight: '',
    boxTemperature: '',
    expressCompanies: ['顺丰速运', '中通快递', '圆通速递', '韵达快递', '申通快递', '中国邮政'],
    packageTypes: ['冷藏箱', '保温箱', '普通箱'],
    coldChainMethods: ['冰袋（2-6°C）', '干冰', '常温'],
    iconClock: icons.clock,
    iconRefresh: icons.refresh,
  },

  onLoad(e: any) {
    if (e.id) this.loadOrder(e.id)
  },

  async loadOrder(id: string) {
    const order = await getClerkOrderById(id)
    this.setData({
      order: order ? {
        ...order,
        items: (order.items || []).map((item: any) => ({
          ...item,
          imageUrl: item.productImage || getProductVisualImage(item.name || item.productName),
        })),
      } : order,
    })
  },

  async onStartPreparing() {
    wx.showLoading({ title: '处理中...' })
    try {
      await markOrderPreparing(this.data.order.id)
      wx.hideLoading()
      wx.showToast({ title: '已开始备货', icon: 'success' })
      this.loadOrder(this.data.order.id)
    } catch (e: any) {
      wx.hideLoading()
      wx.showToast({ title: e?.message || '操作失败', icon: 'none' })
    }
  },

  onInputExpress() {
    this.setData({ showExpressPanel: true })
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

  async onSubmitExpress() {
    if (!this.data.selectedCompany || !this.data.expressNo) {
      wx.showToast({ title: '请选择快递公司并填写单号', icon: 'none' })
      return
    }
    if (!this.data.packageType || !this.data.coldChainMethod || !this.data.boxTemperature) {
      wx.showToast({ title: '请补全冷链发货信息', icon: 'none' })
      return
    }
    wx.showLoading({ title: '提交中...' })
    try {
      await clerkShipOrder({
        orderId: this.data.order.id,
        expressCompany: this.data.selectedCompany,
        expressNo: this.data.expressNo,
        packageType: this.data.packageType,
        coldChainMethod: this.data.coldChainMethod,
        packageWeight: this.data.packageWeight,
        boxTemperature: this.data.boxTemperature,
      })
      wx.hideLoading()
      const order = this.data.order
      const shipping = order.shipping || {}
      const address = shipping.address || order.shippingAddress || {}
      const shipInfo = encodeURIComponent(JSON.stringify({
        orderId: order.id,
        orderNo: order.orderNo || order.id,
        recipient: address.recipient || order.customerName || '',
        phone: address.phone || order.customerPhone || '',
        address: [address.province, address.city, address.district, address.detail].filter(Boolean).join('') || order.address || '',
        expressCompany: this.data.selectedCompany,
        expressNo: this.data.expressNo,
        packageType: this.data.packageType,
        coldChainMethod: this.data.coldChainMethod,
        packageWeight: this.data.packageWeight,
        boxTemperature: this.data.boxTemperature,
      }))
      wx.redirectTo({ url: `/pages/clerk/ship-success/ship-success?shipInfo=${shipInfo}` })
    } catch (e: any) {
      wx.hideLoading()
      wx.showToast({ title: e?.message || '提交失败', icon: 'none' })
    }
  },

  async onScanTap() {
    try {
      const res = await wx.scanCode({ onlyFromCamera: true })
      if (res.result) {
        this.setData({ expressNo: res.result })
        wx.showToast({ title: '扫码成功', icon: 'success' })
      }
    } catch (e) {
      wx.showToast({ title: '扫码失败，请手动输入', icon: 'none' })
    }
  },

  onClosePanel() {
    this.setData({
      showExpressPanel: false,
      selectedCompany: '',
      expressNo: '',
      packageType: '冷藏箱',
      coldChainMethod: '冰袋（2-6°C）',
      packageWeight: '',
      boxTemperature: '',
    })
  },
})

export {}
