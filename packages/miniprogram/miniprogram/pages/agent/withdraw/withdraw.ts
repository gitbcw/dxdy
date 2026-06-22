const {
  getCommissionSummary,
  getWithdrawalRecords,
  requestWithdrawal,
  saveAgentBankCard,
  deleteAgentBankCard,
  formatMoney,
} = require('../../../services/index')

const MIN_WECHAT_WITHDRAW_AMOUNT = 0.3
const MAX_WECHAT_WITHDRAW_AMOUNT = 200
const WECHAT_WITHDRAW_RULE_TEXT = '单笔提现金额需满足：0.30 元 <= 金额 < 200 元'

function normalizeCardNo(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function isValidBankCardNo(value: string) {
  const cardNo = normalizeCardNo(value)
  if (!/^\d{13,19}$/.test(cardNo)) return false
  let sum = 0
  let shouldDouble = false
  for (let i = cardNo.length - 1; i >= 0; i -= 1) {
    let digit = Number(cardNo[i])
    if (shouldDouble) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    shouldDouble = !shouldDouble
  }
  return sum % 10 === 0
}

Page({
  data: {
    summary: null as any,
    bankCards: [] as any[],
    activeBankCard: null as any,
    amount: '',
    records: [] as any[],
    form: {
      id: '',
      bankName: '',
      cardNo: '',
      holderName: '',
    },
    showBankForm: false,
    minWithdrawAmount: MIN_WECHAT_WITHDRAW_AMOUNT,
    maxWithdrawAmount: MAX_WECHAT_WITHDRAW_AMOUNT,
    withdrawRuleText: WECHAT_WITHDRAW_RULE_TEXT,
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
      approved: '审核通过',
      transferring: '微信零钱打款中',
      transfer_failed: '微信零钱打款失败',
      rejected: '已驳回',
      paid: '已打款',
      completed: '已打款',
    }
    return map[status] || status
  },

  onAmountInput(e: any) {
    this.setData({ amount: e.detail.value })
  },

  onFormInput(e: any) {
    const field = e.currentTarget.dataset.field
    const value = field === 'cardNo' ? normalizeCardNo(e.detail.value) : e.detail.value
    this.setData({ [`form.${field}`]: value })
  },

  onToggleBankForm() {
    if (this.data.showBankForm) {
      this.setData({
        showBankForm: false,
        form: { id: '', bankName: '', cardNo: '', holderName: '' },
      })
      return
    }
    const card = this.data.activeBankCard
    this.setData({
      showBankForm: true,
      form: {
        id: card?.id || '',
        bankName: card?.bankName || '',
        cardNo: normalizeCardNo(card?.cardNo || ''),
        holderName: card?.holderName || '',
      },
    })
  },

  async onSaveBankCard() {
    const user = getApp().globalData.userInfo
    if (!user) return
    const form = {
      ...this.data.form,
      bankName: String(this.data.form.bankName || '').trim(),
      cardNo: normalizeCardNo(this.data.form.cardNo),
      holderName: String(this.data.form.holderName || '').trim(),
    }
    if (!form.bankName || !form.cardNo || !form.holderName) {
      wx.showToast({ title: '请完善银行卡信息', icon: 'none' })
      return
    }
    if (!isValidBankCardNo(form.cardNo)) {
      wx.showToast({ title: '银行卡号校验未通过', icon: 'none' })
      return
    }
    wx.showModal({
      title: '请仔细核对银行卡',
      content: '请确认开户行、银行卡号、持卡人姓名准确无误。因填写错误导致提现失败、延迟或打款至错误账户的风险，由用户自行承担。',
      confirmText: '确认无误',
      cancelText: '再检查',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '保存中...' })
        const result = await saveAgentBankCard(user.id, form)
        wx.hideLoading()
        if (!result.success) {
          wx.showToast({ title: result.error || '保存失败', icon: 'none' })
          return
        }
        getApp().globalData.userInfo = result.user
        wx.setStorageSync('current_user', JSON.stringify(result.user))
        this.setData({
          showBankForm: false,
          form: { id: '', bankName: '', cardNo: '', holderName: '' },
        })
        wx.showToast({ title: '已保存' })
        this.loadData()
      },
    })
  },

  async onDeleteBankCard() {
    const user = getApp().globalData.userInfo
    const card = this.data.activeBankCard
    if (!user || !card?.id) return
    wx.showModal({
      title: '删除银行卡',
      content: `确认删除 ${card.bankName}（${card.tailNo}）吗？删除后提现前需要重新添加银行卡。`,
      confirmText: '删除',
      confirmColor: '#dc2626',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '删除中...' })
        const result = await deleteAgentBankCard(user.id, card.id)
        wx.hideLoading()
        if (!result.success) {
          wx.showToast({ title: result.error || '删除失败', icon: 'none' })
          return
        }
        getApp().globalData.userInfo = result.user
        wx.setStorageSync('current_user', JSON.stringify(result.user))
        this.setData({
          showBankForm: false,
          form: { id: '', bankName: '', cardNo: '', holderName: '' },
        })
        wx.showToast({ title: '已删除' })
        this.loadData()
      },
    })
  },

  async onSubmitWithdraw() {
    const user = getApp().globalData.userInfo
    const amount = Number(this.data.amount)
    const available = this.data.summary?.available || this.data.summary?.withdrawable || 0
    if (!this.data.activeBankCard) {
      wx.showToast({ title: '请先添加银行卡', icon: 'none' })
      return
    }
    if (!Number.isFinite(amount)) {
      wx.showToast({ title: '请输入有效提现金额', icon: 'none' })
      return
    }
    if (amount < MIN_WECHAT_WITHDRAW_AMOUNT || amount >= MAX_WECHAT_WITHDRAW_AMOUNT) {
      wx.showToast({ title: WECHAT_WITHDRAW_RULE_TEXT, icon: 'none' })
      return
    }
    if (amount > available) {
      wx.showToast({ title: '超过可提现金额', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认提现',
      content: `提现金额：¥${formatMoney(amount)}\n到账银行卡：${this.data.activeBankCard.bankName}（${this.data.activeBankCard.tailNo}）\n${WECHAT_WITHDRAW_RULE_TEXT}\n平台审核通过后将通过微信零钱自动打款。`,
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
