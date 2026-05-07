const {
  getCommissionSummary,
  getWithdrawalRecords,
  requestWithdrawal,
  saveAgentBankCard,
  formatMoney,
} = require('../../../services/index')

Page({
  data: {
    summary: null as any,
    bankCards: [] as any[],
    activeBankCard: null as any,
    amount: '',
    records: [] as any[],
    form: {
      bankName: '',
      cardNo: '',
      holderName: '',
    },
    showBankForm: false,
    minWithdrawAmount: 100,
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    const user = getApp().globalData.userInfo
    const [summary, records] = await Promise.all([
      getCommissionSummary(),
      user?.id ? getWithdrawalRecords(user.id) : Promise.resolve([]),
    ])
    const bankCards = (user?.bankCards || []).map((card: any) => ({
      ...card,
      tailNo: String(card.cardNo || '').slice(-4),
    }))
    this.setData({
      summary,
      bankCards,
      activeBankCard: bankCards[0] || null,
      records: records.map((record: any) => ({
        ...record,
        amountText: formatMoney(record.amount || 0),
        statusText: this.getStatusText(record.status),
        statusClass: record.status,
      })),
    })
  },

  getStatusText(status: string) {
    const map: Record<string, string> = {
      pending_review: '审核中',
      approved: '已通过',
      rejected: '已驳回',
      paid: '已打款',
    }
    return map[status] || status
  },

  onAmountInput(e: any) {
    this.setData({ amount: e.detail.value })
  },

  onFormInput(e: any) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  onToggleBankForm() {
    this.setData({ showBankForm: !this.data.showBankForm })
  },

  async onSaveBankCard() {
    const user = getApp().globalData.userInfo
    if (!user) return
    wx.showLoading({ title: '保存中...' })
    const result = await saveAgentBankCard(user.id, this.data.form)
    wx.hideLoading()
    if (!result.success) {
      wx.showToast({ title: result.error || '保存失败', icon: 'none' })
      return
    }
    getApp().globalData.userInfo = result.user
    wx.setStorageSync('current_user', JSON.stringify(result.user))
    this.setData({
      showBankForm: false,
      form: { bankName: '', cardNo: '', holderName: '' },
    })
    wx.showToast({ title: '已保存' })
    this.loadData()
  },

  async onSubmitWithdraw() {
    const user = getApp().globalData.userInfo
    const amount = Number(this.data.amount)
    const available = this.data.summary?.available || this.data.summary?.withdrawable || 0
    if (!this.data.activeBankCard) {
      wx.showToast({ title: '请先添加银行卡', icon: 'none' })
      return
    }
    if (!Number.isFinite(amount) || amount < this.data.minWithdrawAmount) {
      wx.showToast({ title: `提现金额需满${this.data.minWithdrawAmount}元`, icon: 'none' })
      return
    }
    if (amount > available) {
      wx.showToast({ title: '超过可提现金额', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认提现',
      content: `提现金额：¥${formatMoney(amount)}\n到账银行卡：${this.data.activeBankCard.bankName}（${this.data.activeBankCard.tailNo}）`,
      confirmText: '提交',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '提交中...' })
        const record = await requestWithdrawal(user.id, amount, this.data.activeBankCard.id)
        wx.hideLoading()
        if (!record) {
          wx.showToast({ title: '提交失败', icon: 'none' })
          return
        }
        wx.showToast({ title: '已提交审核' })
        this.setData({ amount: '' })
        this.loadData()
      },
    })
  },
})

export {}
