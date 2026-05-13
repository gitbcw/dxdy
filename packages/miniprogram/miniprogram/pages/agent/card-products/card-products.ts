const {
  getCardVoucherProducts,
  getProductVisualImage,
  formatMoney,
  getEffectivePrice,
} = require('../../../services/index')

Page({
  data: {
    products: [] as any[],
    loading: false,
  },

  onShow() {
    this.loadProducts()
  },

  onPullDownRefresh() {
    this.loadProducts().then(() => wx.stopPullDownRefresh())
  },

  async loadProducts() {
    this.setData({ loading: true })
    try {
      const products = await getCardVoucherProducts()
      this.setData({
        products: products.map((product: any) => ({
          ...product,
          imageUrl: getProductVisualImage(product),
          priceText: formatMoney(getEffectivePrice(product, 'personal')),
          specText: product.specs?.[0]?.value || product.description || '血包卡券',
          redeemText: product.redeemableCategory ? '指定血包品类可兑换' : '血包商品通用兑换',
          stockText: typeof product.stock === 'number' ? `库存 ${product.stock}` : '库存充足',
        })),
      })
    } catch (err: any) {
      wx.showToast({ title: err?.message || '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onProductTap(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${id}` })
  },
})

export {}
