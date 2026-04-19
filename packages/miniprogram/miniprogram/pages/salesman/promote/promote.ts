const icons = require('../../../services/icons')

Page({
  data: {
    qrcodeUrl: '',
    promoteLink: '',
    userId: '',
  },

  onLoad() {
    const app = getApp()
    const user = app.globalData.userInfo
    const userId = user?.id || 'unknown'
    const link = `https://dxdy.com/register?from=salesman_${userId}`
    this.setData({
      userId,
      qrcodeUrl: link,
      promoteLink: link,
    })
    // 启用分享
    wx.showShareMenu({ withShareTicket: true })
  },

  onSaveQrcode() {
    // MVP：提示长按保存
    wx.showToast({ title: '请长按图片保存', icon: 'none' })
  },

  onCopyLink() {
    wx.setClipboardData({
      data: this.data.promoteLink,
      success: () => wx.showToast({ title: '链接已复制' }),
    })
  },
})

export {}
