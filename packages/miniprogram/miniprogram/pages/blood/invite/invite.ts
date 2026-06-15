const { createBloodBookingInvite } = require('../../../services/index')
const icons = require('../../../services/icons')

Page({
  data: {
    loading: true,
    error: '',
    invite: null as any,
    qrcodeUrl: '',
    hospitalIcon: icons.hospital,
  },

  onLoad() {
    this.loadInvite()
  },

  async loadInvite() {
    this.setData({ loading: true, error: '' })
    try {
      const invite = await createBloodBookingInvite()
      this.setData({
        invite,
        qrcodeUrl: invite.qrcodeUrl || invite.qrcodeFileId || '',
      })
      wx.showShareMenu({ withShareTicket: true })
    } catch (err: any) {
      this.setData({ error: err?.message || '生成预约二维码失败' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onRefreshTap() {
    this.loadInvite()
  },

  onShareAppMessage() {
    return {
      title: '预约用血',
      path: this.data.invite?.path || '/pages/login/login',
    }
  },
})

export {}
