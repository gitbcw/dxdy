const { getUserCoupons, formatMoney } = require('../../services/index')

Page({
  data: {
    coupons: [] as any[],
    activeTab: 'available' as string,
    tabs: [
      { key: 'available', label: '可用' },
      { key: 'used', label: '已使用' },
      { key: 'expired', label: '已过期' },
    ],
  },

  async onLoad() {
    await this._loadCoupons()
  },

  async onPullDownRefresh() {
    await this._loadCoupons()
    wx.stopPullDownRefresh()
  },

  async _loadCoupons() {
    try {
      const all = await getUserCoupons()
      this.setData({ coupons: all })
    } catch {
      this.setData({ coupons: [] })
    }
  },

  onTabChange(e: any) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },
})

export {}
