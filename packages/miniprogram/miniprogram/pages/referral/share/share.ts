const tracking = require('../../../services/tracking')

Page({
  data: {
    referralCode: '',
    referralLink: '',
    referredCount: 0,
    rewardPoints: 0,
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    const app = getApp()
    const user = app.globalData.userInfo
    if (!user) return

    const db = wx.cloud.database()
    const { data } = await db.collection('users').doc(user.id || user._id).get()

    // 统计推荐人数
    const { total } = await db.collection('users').where({ referredBy: data._id }).count()

    this.setData({
      referralCode: data.referralCode || '',
      referralLink: data.referralCode ? `pages/login/login?referralCode=${data.referralCode}` : '',
      referredCount: total || 0,
    })
  },

  onCopyCode() {
    wx.setClipboardData({
      data: this.data.referralCode,
      success: () => wx.showToast({ title: '已复制推荐码', icon: 'success' }),
    })
  },

  onShareAppMessage() {
    tracking.trackReferralShare(this.data.referralCode)
    return {
      title: '大熊动医 — 宠物医疗检测，推荐有礼',
      path: this.data.referralLink,
    }
  },
})

export {}
