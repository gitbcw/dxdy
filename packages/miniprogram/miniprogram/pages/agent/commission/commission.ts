const { getCommissionSummary, requestWithdrawalByAmount, getCommissionRecords } = require('../../../services/index')

Page({
  data: {
    summary: null as any,
    canWithdraw: false,
    records: [] as any[],
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    const user = getApp().globalData.userInfo
    const [summary, records] = await Promise.all([
      getCommissionSummary(),
      user?.id ? getCommissionRecords(user.id) : Promise.resolve([]),
    ])

    // 格式化提成记录
    const formattedRecords = records.map((r: any) => ({
      ...r,
      amountText: r.amount >= 0 ? `+${r.amount.toFixed(2)}` : r.amount.toFixed(2),
      amountClass: r.amount >= 0 ? 'positive' : 'negative',
      sourceLabel: this.getSourceLabel(r.sourceType),
    }))

    this.setData({
      summary,
      canWithdraw: summary.withdrawable >= 100,
      records: formattedRecords,
    })
  },

  getSourceLabel(type: string): string {
    const map: Record<string, string> = {
      order: '订单提成',
      return_deduction: '退货扣减',
      exchange_adjustment: '换货调整',
      price_modification: '改价调整',
    }
    return map[type] || type
  },

  onWithdraw() {
    wx.navigateTo({ url: '/pages/agent/withdraw/withdraw' })
  },
})
