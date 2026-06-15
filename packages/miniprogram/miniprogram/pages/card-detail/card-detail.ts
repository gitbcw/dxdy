const {
  getCardById,
  manageCardVoucher,
  formatMoney,
} = require('../../services/index')

const statusText: Record<string, string> = {
  ungifted: '待赠送',
  gifted: '待认领',
  claimed: '已认领',
  redeemed: '已兑换',
  verified: '已核销',
  expired: '已过期',
  voided: '已作废',
}

function decodeScene(options: any) {
  if (options?.id) return decodeURIComponent(options.id)
  if (options?.scene) return decodeURIComponent(options.scene)
  return ''
}

function getDeductionAmount(card: any): number {
  return Number(
    card?.deductionAmount ??
    card?.discountAmount ??
    card?.amount ??
    card?.faceValue ??
    card?.value ??
    0
  ) || 0
}

function getAmountText(card: any): string {
  return formatMoney(getDeductionAmount(card))
}

Page({
  data: {
    card: null as any,
    cardId: '',
    statusText: '',
    canClaim: false,
    canRegift: false,
    isHolder: false,
    showRegiftPanel: false,
    shareQrcodeUrl: '',
    shareLink: '',
    amountText: '0.00',
    loading: false,
  },

  onLoad(options: any) {
    const cardId = decodeScene(options)
    if (!cardId) return
    this.setData({ cardId, shareLink: `/pages/card-detail/card-detail?id=${encodeURIComponent(cardId)}` })
    this.loadCard(cardId)
  },

  onShow() {
    if (this.data.cardId) this.loadCard(this.data.cardId)
  },

  async loadCard(id: string) {
    const card = await getCardById(id)
    const app = getApp()
    const user = app.globalData.userInfo

    if (!card) {
      if (user) {
        await this.claimSharedCard(id)
        return
      }
      this.promptLogin()
      return
    }

    const isHolder = !!user && card.currentHolderId === user.id
    this.setData({
      card,
      amountText: getAmountText(card),
      statusText: statusText[card.status] || card.status,
      isHolder,
      canClaim: isHolder && card.status === 'gifted',
      canRegift: isHolder && ['claimed', 'gifted'].includes(card.status),
    })
  },

  promptLogin() {
    wx.showModal({
      title: '请先登录',
      content: '登录或注册后即可认领这张卡券。',
      confirmText: '去登录',
      success: res => {
        if (res.confirm) {
          wx.navigateTo({
            url: `/pages/login/login?redirect=${encodeURIComponent(`/pages/card-detail/card-detail?id=${encodeURIComponent(this.data.cardId)}`)}`,
          })
        }
      },
    })
  },

  async claimSharedCard(cardId: string) {
    this.setData({ loading: true })
    try {
      await manageCardVoucher({ action: 'claimShared', cardId })
      wx.showToast({ title: '认领成功', icon: 'success' })
      const card = await getCardById(cardId)
      if (card) {
        this.setData({
          card,
          amountText: getAmountText(card),
          statusText: statusText[card.status] || card.status,
          canClaim: false,
          canRegift: true,
          isHolder: true,
        })
      }
    } catch (err: any) {
      wx.showToast({ title: err.message || '认领失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async onClaimTap() {
    await this.claimSharedCard(this.data.card.id)
  },

  async onShowRegiftPanel() {
    if (!this.data.card?.id) return
    this.setData({ showRegiftPanel: true })
    if (this.data.shareQrcodeUrl) return

    this.setData({ loading: true })
    try {
      const result = await manageCardVoucher({ action: 'shareCode', cardId: this.data.card.id })
      this.setData({
        shareQrcodeUrl: result.fileID || '',
        shareLink: result.path || this.data.shareLink,
      })
    } catch (err: any) {
      wx.showToast({ title: err.message || '生成二维码失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onCloseRegiftPanel() {
    this.setData({ showRegiftPanel: false })
  },

  onShareAppMessage() {
    return {
      title: `领取卡券：${this.data.card?.productName || ''}`,
      path: this.data.shareLink || `/pages/card-detail/card-detail?id=${this.data.cardId}`,
    }
  },
})

export {}
