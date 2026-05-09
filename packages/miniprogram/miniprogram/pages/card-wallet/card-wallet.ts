const { getMyCards, getGiftedCards } = require('../../services/index')

Page({
  data: {
    activeTab: 'gifted',
    tabs: [
      { key: 'gifted', label: '待认领' },
      { key: 'claimed', label: '可使用' },
      { key: 'redeemed', label: '已兑换' },
      { key: 'all', label: '全部' },
    ],
    allCards: [] as any[],
    visibleCards: [] as any[],
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
    // 合并去重（gifted 可能也在 all 里）
    const map = new Map<string, any>()
    for (const c of [...all, ...gifted]) {
      map.set(c.id, c)
    }
    const allCards = Array.from(map.values())
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
    this.setData({ visibleCards })
  },

  onCardTap(e: any) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/card-detail/card-detail?id=${id}` })
  },
})

export {}
