const { GENERATED_ASSETS, manageCardVoucher } = require('../../../services/index')
const icons = require('../../../services/icons')

Page({
  data: {
    icons,
    qrcodeUrl: '',
    avatarIcon: icons.agent,
    userId: '',
    agentName: '张三',
    promoCode: 'DXY123456',
    sharePath: '/pages/register/register',
    promotionImage: GENERATED_ASSETS.agentPromotion,
    stats: {
      scanVisits: 0,
      registeredCustomers: 0,
      orderedCustomers: 0,
    },
    loading: false,
  },

  onLoad() {
    this.loadPromoCode()
    wx.showShareMenu({ withShareTicket: true })
  },

  async loadPromoCode() {
    const app = getApp()
    const user = app.globalData.userInfo
    const userId = user?.id || 'unknown'
    const fallbackCode = user?.referralCode || `DXY${String(userId).replace(/\D/g, '').slice(-6).padStart(6, '0')}`

    this.setData({
      userId,
      agentName: user?.nickname || '张三',
      promoCode: fallbackCode,
      sharePath: `/pages/register/register?referralCode=${encodeURIComponent(fallbackCode)}`,
    })
    this.setData({ loading: true })
    try {
      const [result, statsResult] = await Promise.all([
        manageCardVoucher({ action: 'agentPromoCode' }),
        manageCardVoucher({ action: 'agentPromoStats' }).catch(() => null),
      ])
      this.setData({
        promoCode: result.referralCode || fallbackCode,
        qrcodeUrl: result.fileID || '',
        sharePath: result.path || `/pages/register/register?referralCode=${encodeURIComponent(result.referralCode || fallbackCode)}`,
        stats: statsResult?.stats || this.data.stats,
      })
    } catch (err: any) {
      wx.showToast({ title: err.message || '生成推广二维码失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onSaveQrcode() {
    wx.showToast({ title: '可长按二维码保存', icon: 'none' })
  },

  onShareAppMessage() {
    return {
      title: '大熊动医小程序邀请注册',
      path: this.data.sharePath,
    }
  },
})

export {}
