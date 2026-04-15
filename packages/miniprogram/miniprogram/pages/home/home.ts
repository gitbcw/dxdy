const { getProducts, getCategories } = require('../../services/index')

Page({
  data: {
    categories: [] as any[],
    products: [] as any[],
    activeCategory: '',
    keyword: '',
  },

  onLoad() {
    this.loadCategories()
    this.loadProducts()
  },

  onPullDownRefresh() {
    this.loadProducts()
    wx.stopPullDownRefresh()
  },

  async loadCategories() {
    const cats = await getCategories()
    this.setData({ categories: cats })
  },

  async loadProducts() {
    const user = getApp().globalData.userInfo
    const visibility = user?.customerType === 'institution' ? 'institution' : 'personal'
    const opts: any = { visibility }
    if (this.data.activeCategory) opts.categoryId = this.data.activeCategory
    if (this.data.keyword) opts.keyword = this.data.keyword
    const products = await getProducts(opts)
    this.setData({ products })
  },

  onCategoryTap(e: any) {
    const id = e.currentTarget.dataset.id
    this.setData({ activeCategory: id === this.data.activeCategory ? '' : id })
    this.loadProducts()
  },

  onSearchInput(e: any) {
    this.setData({ keyword: e.detail.value })
  },

  onSearch() {
    this.loadProducts()
  },

  onProductTap(e: any) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/orders/create/create?productId=${id}` })
  },
})
