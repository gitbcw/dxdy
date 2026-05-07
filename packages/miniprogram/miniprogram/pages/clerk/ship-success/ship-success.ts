Page({
  data: {
    orderId: '',
    orderNo: '',
    recipient: '',
    phone: '',
    address: '',
    expressCompany: '',
    expressNo: '',
  },

  onLoad(options: any) {
    const params = options.shipInfo ? JSON.parse(decodeURIComponent(options.shipInfo)) : {}
    this.setData({
      orderId: params.orderId || '',
      orderNo: params.orderNo || '',
      recipient: params.recipient || '',
      phone: params.phone || '',
      address: params.address || '',
      expressCompany: params.expressCompany || '',
      expressNo: params.expressNo || '',
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
