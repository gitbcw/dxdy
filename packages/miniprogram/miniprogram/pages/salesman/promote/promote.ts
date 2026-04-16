const icons = require('../../../services/icons')

Page({
  data: {
    qrcodeUrl: '',
    推广链接: '',
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
      推广链接: link,
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
      data: this.data.推广链接,
      success: () => wx.showToast({ title: '链接已复制' }),
    })
  },
})
