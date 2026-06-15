const {
  formatMoney,
  getOrderById,
  payOrder,
} = require('../../../services/index')

async function callManageCardVoucher(data: Record<string, any>) {
  const { result } = await wx.cloud.callFunction({
    name: 'manageCardVoucher',
    data,
  }) as any
  if (!result?.success) throw new Error(result?.error || '卡券操作失败')
  return result
}

Page({
  data: {
    cards: [] as any[],
    loading: false,
    purchasingId: '',
  },

  onShow() {
    this.loadCards()
  },

  onPullDownRefresh() {
    this.loadCards().then(() => wx.stopPullDownRefresh())
  },

  async waitForPaymentResult(orderId: string) {
    for (let i = 0; i < 8; i += 1) {
      const order = await getOrderById(orderId)
      if (order?.payment?.status === 'paid' || order?.status === 'completed') return order
      await new Promise(resolve => setTimeout(resolve, 1200))
    }
    return null
  },

  async loadCards() {
    this.setData({ loading: true })
    try {
      const result = await callManageCardVoucher({ action: 'listAvailable' })
      const cards = result.cards || []
      this.setData({
        cards: cards.map((card: any) => ({
          ...card,
          imageUrl: card.productImage || '',
          name: card.productName || '卡券',
          priceText: formatMoney(Number(card.purchaseAmount || card.deductionAmount || card.discountAmount || 0)),
          deductionText: formatMoney(Number(card.deductionAmount || card.discountAmount || 0)),
          specText: card.cardNo || '未赠送卡券',
          redeemText: '购买后可赠送给医院客户',
        })),
      })
    } catch (err: any) {
      wx.showToast({ title: err?.message || '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async onBuyTap(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    this.setData({ purchasingId: id })
    wx.showLoading({ title: '正在下单...' })
    try {
      const purchaseResult = await callManageCardVoucher({ action: 'purchase', cardId: id })
      const orderId = purchaseResult.orderId
      if (!orderId) throw new Error('卡券订单创建失败')

      const payResult = await payOrder(orderId, 'wechat')
      if (!payResult?.success) {
        wx.hideLoading()
        wx.showToast({ title: payResult?.error || '微信支付下单失败', icon: 'none' })
        return
      }
      if (!payResult.payment) {
        wx.hideLoading()
        wx.showToast({ title: '微信支付参数缺失', icon: 'none' })
        return
      }

      wx.hideLoading()
      await new Promise<void>((resolve, reject) => {
        wx.requestPayment({
          ...payResult.payment,
          success: () => resolve(),
          fail: (err: WechatMiniprogram.GeneralCallbackResult) => reject(err),
        })
      })

      wx.showLoading({ title: '确认支付结果', mask: true })
      const paidOrder = await this.waitForPaymentResult(orderId)
      wx.hideLoading()
      if (!paidOrder) {
        wx.showToast({ title: '支付已完成，结果确认中', icon: 'none' })
        return
      }

      wx.showToast({ title: '购买成功', icon: 'success' })
      this.loadCards()
    } catch (err: any) {
      wx.hideLoading()
      const message = String(err?.errMsg || err?.message || '')
      wx.showToast({ title: message.includes('cancel') ? '已取消支付' : '购买失败，请重试', icon: 'none' })
    } finally {
      this.setData({ purchasingId: '' })
    }
  },
})

export {}
