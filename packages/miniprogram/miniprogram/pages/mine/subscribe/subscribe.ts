const icons = require('../../../services/icons')

Page({
  data: {
    bellIcon: icons.subscribe,
    qrCodeUrl: '',
    officialAccountName: '大熊动医',
    tips: [
      '关注公众号后，可接收订单状态、物流发货、预约提醒等消息通知。',
      '如已关注，请返回小程序并在「设置」中开启订阅消息。',
    ],
  },

  onLoad() {
    // 可在此调用接口获取公众号二维码 URL，当前使用占位图
  },

  onPreviewQrCode() {
    const qrUrl = this.data.qrCodeUrl
    if (!qrUrl) return
    wx.previewImage({
      urls: [qrUrl],
      current: qrUrl,
    })
  },

  onCopyOfficialAccount() {
    wx.setClipboardData({
      data: this.data.officialAccountName,
      success: () => {
        wx.showToast({ title: '已复制公众号名称', icon: 'none' })
      },
    })
  },

  onOpenSubscribeSettings() {
    wx.openSetting({
      withSubscriptions: true,
    })
  },
})

export {}
