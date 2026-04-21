Page({
  data: {
    favorites: [
      {
        id: 1,
        name: '犬猫通用全血细胞计数(CBC)',
        price: 68,
        originalPrice: 88,
        image: '',
        specs: '常规血液检测',
        salesCount: 1236,
      },
      {
        id: 2,
        name: '生化全套检查(含肝肾功能)',
        price: 158,
        originalPrice: 198,
        image: '',
        specs: '24项生化指标',
        salesCount: 892,
      },
      {
        id: 3,
        name: '犬细小病毒快速检测 CPV-Ag',
        price: 45,
        originalPrice: 60,
        image: '',
        specs: '胶体金法 / 10份装',
        salesCount: 2340,
      },
    ] as any[],
  },

  onRemoveFavorite(e: any) {
    const id = e.currentTarget.dataset.id
    const favorites = this.data.favorites.filter((f: any) => f.id !== id)
    this.setData({ favorites })
    wx.showToast({ title: '已取消收藏', icon: 'success' })
  },

  onItemTap(e: any) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${id}` })
  },

  onAddToCart(e: any) {
    const id = e.currentTarget.dataset.id
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },
})

export {}
