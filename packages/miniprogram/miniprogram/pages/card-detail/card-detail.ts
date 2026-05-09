const {
  getCardById,
  getRedeemableProducts,
  manageCardVoucher,
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

Page({
  data: {
    card: null as any,
    statusText: '',
    canClaim: false,
    canRegift: false,
    canRedeem: false,
    isHolder: false,
    redeemProducts: [] as any[],
    selectedProductId: '',
    selectedProductName: '',
    showRedeemPanel: false,
    showRegiftPanel: false,
    regiftSearchText: '',
    regiftResults: [] as any[],
    regiftSelectedId: '',
    regiftSelectedName: '',
    loading: false,
  },

  onLoad(options: any) {
    if (options?.id) this.loadCard(options.id)
  },

  async loadCard(id: string) {
    const card = await getCardById(id)
    if (!card) { wx.showToast({ title: '卡券不存在', icon: 'none' }); return }

    const app = getApp()
    const user = app.globalData.userInfo
    const isHolder = user && card.currentHolderId === user.id

    this.setData({
      card,
      statusText: statusText[card.status] || card.status,
      isHolder,
      canClaim: isHolder && card.status === 'gifted',
      canRegift: isHolder && ['claimed', 'gifted'].includes(card.status),
      canRedeem: isHolder && card.status === 'claimed' && user?.verificationStatus === 'approved',
    })

    if (card.status === 'claimed' && card.redeemableCategory && user?.verificationStatus === 'approved') {
      const products = await getRedeemableProducts(card.redeemableCategory)
      this.setData({ redeemProducts: products })
    }
  },

  async onClaimTap() {
    this.setData({ loading: true })
    try {
      await manageCardVoucher({ action: 'claim', cardId: this.data.card.id })
      wx.showToast({ title: '认领成功', icon: 'success' })
      this.loadCard(this.data.card.id)
    } catch (err: any) {
      wx.showToast({ title: err.message || '认领失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onShowRegiftPanel() {
    this.setData({ showRegiftPanel: true, regiftSearchText: '', regiftResults: [], regiftSelectedId: '' })
  },

  onCloseRegiftPanel() {
    this.setData({ showRegiftPanel: false })
  },

  async onRegiftSearch(e: any) {
    const keyword = (e.detail.value || '').trim()
    this.setData({ regiftSearchText: keyword })
    if (!keyword) { this.setData({ regiftResults: [] }); return }

    const db = wx.cloud.database()
    const _ = db.command
    const { data } = await db.collection('users')
      .where({
        role: 'customer',
        customerType: 'institution',
        ...(_.or([
          { nickname: db.RegExp({ regexp: keyword, options: 'i' }) },
          { phone: db.RegExp({ regexp: keyword, options: 'i' }) },
        ]) as any),
      })
      .limit(20)
      .get()
    this.setData({
      regiftResults: (data || []).map((u: any) => ({
        id: u._id,
        name: u.nickname || u.phone || '未命名',
        phone: u.phone || '',
      })),
    })
  },

  onSelectRegiftTarget(e: any) {
    const { id, name } = e.currentTarget.dataset
    this.setData({ regiftSelectedId: id, regiftSelectedName: name })
  },

  async onConfirmRegift() {
    if (!this.data.regiftSelectedId) { wx.showToast({ title: '请选择转赠对象', icon: 'none' }); return }
    this.setData({ loading: true })
    try {
      await manageCardVoucher({ action: 'regift', cardId: this.data.card.id, toUserId: this.data.regiftSelectedId })
      wx.showToast({ title: '转赠成功', icon: 'success' })
      this.setData({ showRegiftPanel: false })
      this.loadCard(this.data.card.id)
    } catch (err: any) {
      wx.showToast({ title: err.message || '转赠失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onShowRedeemPanel() {
    this.setData({ showRedeemPanel: true })
  },

  onCloseRedeemPanel() {
    this.setData({ showRedeemPanel: false })
  },

  onSelectProduct(e: any) {
    const { id, name } = e.currentTarget.dataset
    this.setData({ selectedProductId: id, selectedProductName: name })
  },

  async onConfirmRedeem() {
    if (!this.data.selectedProductId) { wx.showToast({ title: '请选择兑换商品', icon: 'none' }); return }
    this.setData({ loading: true })
    try {
      await manageCardVoucher({
        action: 'redeem',
        cardId: this.data.card.id,
        redeemProductId: this.data.selectedProductId,
      })
      wx.showToast({ title: '兑换成功', icon: 'success' })
      this.setData({ showRedeemPanel: false })
      this.loadCard(this.data.card.id)
    } catch (err: any) {
      wx.showToast({ title: err.message || '兑换失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
})

export {}
