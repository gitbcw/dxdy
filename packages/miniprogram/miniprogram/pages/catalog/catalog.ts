const { getCategories, getProducts, formatMoney } = require('../../services/index')

Page({
  data: {
    categories: [] as any[],
    products: [] as any[],
    activeCategory: '',
  },

  onLoad() {
    this.loadCategories()
  },

  async loadCategories() {
    const cats = await getCategories()
    this.setData({ categories: cats })
    if (cats.length > 0) {
      this.setData({ activeCategory: cats[0].id })
      this.loadProducts()
    }
  },

  async loadProducts() {
    if (!this.data.activeCategory) return
    const user = getApp().globalData.userInfo
    const visibility = user?.customerType === 'institution' ? 'institution' : 'personal'
    const products = await getProducts({ visibility, categoryId: this.data.activeCategory })
    const isInstitution = visibility === 'institution'
    this.setData({
      products: products.map((product: any) => ({
        ...product,
        priceText: formatMoney(isInstitution ? product.institutionPrice : (product.personalPrice || product.institutionPrice)),
        specText: product.specs?.[0]?.value || '标准规格',
        tagText: product.visibility === 'institution_only' ? '机构专属' : product.isBloodPack ? '用血预约' : '可采购',
      })),
    })
  },

  onCategoryTap(e: any) {
    this.setData({ activeCategory: e.currentTarget.dataset.id })
    this.loadProducts()
  },

  onProductTap(e: any) {
    wx.navigateTo({ url: `/pages/orders/create/create?productId=${e.currentTarget.dataset.id}` })
  },
})

export {}
