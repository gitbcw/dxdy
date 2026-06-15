const { getMyCards, getGiftedCards, formatMoney } = require('../../services/index')

const statusTextMap: Record<string, string> = {
  ungifted: '待赠送',
  gifted: '待认领',
  claimed: '可使用',
  redeemed: '已兑换',
  verified: '已核销',
  expired: '已过期',
  voided: '已作废',
}

function getDeductionAmount(card: any): number {
  return Number(card?.deductionAmount ?? card?.discountAmount ?? card?.amount ?? 0) || 0
}

function formatCardDate(value?: string): string {
  if (!value) return '未设置'
  return String(value).slice(0, 16)
}

function mapCard(card: any) {
  const amount = getDeductionAmount(card)
  return {
    ...card,
    id: card.id || card._id || card.cardNo,
    productName: card.productName || card.name || '血包卡券',
    amountText: formatMoney(amount),
    statusText: statusTextMap[card.status] || card.status || '未知',
    claimedAtText: card.claimedAt ? formatCardDate(card.claimedAt) : '',
    redeemedAtText: card.redeemedAt ? formatCardDate(card.redeemedAt) : '',
    sortTime: card.updatedAt || card.createdAt || card.expiresAt || '',
  }
}

Page({
  data: {
    activeTab: 'all',
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'gifted', label: '待认领' },
      { key: 'claimed', label: '可使用' },
      { key: 'redeemed', label: '已兑换' },
    ],
    allCards: [] as any[],
    visibleCards: [] as any[],
    totalCount: 0,
    availableCount: 0,
  },

  onShow() {
    this.loadCards()
  },

  onPullDownRefresh() {
    this.loadCards().then(() => wx.stopPullDownRefresh())
  },

  async loadCards() {
    const [gifted, all] = await Promise.all([
      getGiftedCards(),
      getMyCards(),
    ])
    // 合并去重，gifted 可能也在 all 里。
    const map = new Map<string, any>()
    for (const card of [...all, ...gifted]) {
      const mapped = mapCard(card)
      map.set(mapped.id, mapped)
    }
    const allCards = Array.from(map.values()).sort((a, b) => String(b.sortTime).localeCompare(String(a.sortTime)))
    this.setData({ allCards })
    this.applyTab()
  },

  onTabChange(e: any) {
    this.setData({ activeTab: e.currentTarget.dataset.key })
    this.applyTab()
  },

  applyTab() {
    const { activeTab, allCards } = this.data
    const visibleCards = activeTab === 'all'
      ? allCards
      : allCards.filter((c: any) => c.status === activeTab)
    this.setData({
      visibleCards,
      totalCount: allCards.length,
      availableCount: allCards.filter((c: any) => c.status === 'claimed').length,
    })
  },

  onCardTap(e: any) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/card-detail/card-detail?id=${id}` })
  },
})

export {}
