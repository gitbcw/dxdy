const { getCommissionSummary, requestWithdrawalByAmount } = require('../../../services/index')

Page({
  data: {
    summary: null as any,
    canWithdraw: false,
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    const summary = await getCommissionSummary()
    this.setData({
      summary,
      canWithdraw: summary.withdrawable >= 100,
    })
  },

  onWithdraw() {
    const { summary } = this.data
    wx.showModal({
      title: '确认提现',
      content: `可提现金额：¥${summary.withdrawable}\n到账银行卡：****6789`,
      confirmText: '确认提现',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '提交中...' })
          try {
            await requestWithdrawalByAmount({ amount: summary.withdrawable })
            wx.hideLoading()
            wx.showToast({ title: '申请已提交，审核中' })
            this.loadData()
          } catch (e) {
            wx.hideLoading()
            wx.showToast({ title: '提交失败', icon: 'none' })
          }
        }
      },
    })
  },
})
