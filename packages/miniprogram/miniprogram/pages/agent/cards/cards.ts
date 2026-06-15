const { getAgentCards, formatMoney } = require('../../../services/index')

const statusLabels: Record<string, string> = {
  all: '全部',
  ungifted: '待赠送',
  gifted: '已赠送',
  claimed: '已认领',
  redeemed: '已兑换',
  voided: '已作废',
}

function getAmount(card: any) {
  return Number(card.deductionAmount ?? card.discountAmount ?? card.amount ?? 0) || 0
}

Page({
  data: {
    cards: [] as any[],
    visibleCards: [] as any[],
    activeFilter: 'all',
    filters: [] as { key: string; label: string }[],
    summaryText: '',
  },

  onShow() {
    this.loadCards()
  },

  onPullDownRefresh() {
    this.loadCards().then(() => wx.stopPullDownRefresh())
  },

  async loadCards() {
    const cards = (await getAgentCards()).map((card: any) => ({
      ...card,
      amountText: formatMoney(getAmount(card)),
      statusText: statusLabels[card.status] || card.status || '未知',
    }))
    const counts: Record<string, number> = { all: cards.length }
    for (const card of cards) {
      counts[card.status] = (counts[card.status] || 0) + 1
    }
    const filters = Object.entries(statusLabels).map(([key, label]) => ({
      key,
      label: key === 'all' ? label : `${label} ${counts[key] || 0}`,
    }))
    this.setData({ cards, filters })
    this.applyFilter()
  },

  applyFilter() {
    const { cards, activeFilter } = this.data
    const visibleCards = activeFilter === 'all' ? cards : cards.filter((c: any) => c.status === activeFilter)
    const ungifted = cards.filter((c: any) => c.status === 'ungifted').length
    this.setData({
      visibleCards,
      summaryText: `共 ${cards.length} 张，${ungifted} 张待赠送`,
    })
  },

  onFilterTap(e: any) {
    this.setData({ activeFilter: e.currentTarget.dataset.key })
    this.applyFilter()
  },

  onCardTap(e: any) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/card-detail/card-detail?id=${id}` })
  },

  onGiftTap(e: any) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/agent/card-gift/card-gift?id=${id}` })
  },
})

export {}
