const icons = require('../../../services/icons')

Page({
  data: {
    orderId: '',
    orderNo: '',
    expressCompany: '',
    expressNo: '',
    packageType: '',
    coldChainMethod: '',
    packageWeight: '',
    boxTemperature: '',
    successIcon: icons.checkSuccess,
  },

  onLoad(options: any) {
    const params = options.shipInfo ? JSON.parse(decodeURIComponent(options.shipInfo)) : {}
    this.setData({
      orderId: params.orderId || '',
      orderNo: params.orderNo || '',
      expressCompany: params.expressCompany || '',
      expressNo: params.expressNo || '',
      packageType: params.packageType || '',
      coldChainMethod: params.coldChainMethod || '',
      packageWeight: params.packageWeight || '',
      boxTemperature: params.boxTemperature || '',
    })
  },

  onCopyExpressNo() {
    wx.setClipboardData({
      data: this.data.expressNo,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    })
  },

  onViewLogistics() {
    wx.navigateTo({
      url: `/pages/clerk/logistics/logistics?orderId=${this.data.orderId}`,
    })
  },

  onBackHome() {
    wx.reLaunch({ url: '/pages/clerk/pending/pending' })
  },
})

export {}
