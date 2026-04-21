const { getCategories, getProducts, formatMoney, addToCart } = require('../../services/index')
const { isStaffRole, normalizePath } = require('../../utils/tab-bar')

Page({
  data: {
    categories: [] as any[],
    allProducts: [] as any[],
    products: [] as any[],
    activeCategory: '',
    searchKeyword: '',
    quickFilters: [] as any[],
    activeQuickFilter: 'all',
    emptyText: '当前分类暂无商品',
    isInstitution: false,
    actionSheetVisible: false,
    actionSheetProduct: {} as any,
    keywordMode: false,
  },

  onLoad() {
    this.loadCategories()
  },

  onShow() {
    if (this.redirectStaffRole()) return
    this.syncTabBar()

    const app = getApp()
    const keyword = (app.globalData.catalogSearchKeyword || wx.getStorageSync('catalog_search_keyword') || '').trim()
    if (!keyword) return

    app.globalData.catalogSearchKeyword = ''
    wx.removeStorageSync('catalog_search_keyword')
    this.setData({
      activeCategory: '',
      searchKeyword: keyword,
      keywordMode: true,
    })
    this.loadProducts()
  },

  syncTabBar() {
    const tabBar = (this as any).getTabBar?.()
    tabBar?.updateForPage?.(normalizePath('/pages/catalog/catalog'))
  },

  redirectStaffRole() {
    const role = getApp().globalData.userRole || 'customer_personal'
    if (!isStaffRole(role)) return false

    wx.switchTab({ url: '/pages/home/home' })
    return true
  },

  async loadCategories() {
    const cats = await getCategories()
    this.setData({ categories: cats })
    if (cats.length > 0) {
      this.setData({ activeCategory: this.data.searchKeyword.trim() ? '' : cats[0].id })
      this.loadProducts()
    }
  },

  async loadProducts() {
    const user = getApp().globalData.userInfo
    const isInstitution = user?.customerType === 'institution'
    const visibility = isInstitution ? 'institution' : 'personal'
    const keyword = this.data.searchKeyword.trim()
    const products = await getProducts({
      visibility,
      categoryId: keyword ? undefined : this.data.activeCategory,
      keyword: keyword || undefined,
    })
    this.setData({ isInstitution })
    const mappedProducts = products.map((product: any) => ({
      ...product,
      priceText: formatMoney(isInstitution ? product.institutionPrice : (product.personalPrice || product.institutionPrice)),
      specText: product.specs?.[0]?.value || '标准规格',
      tagText: product.visibility === 'institution_only' ? '机构专属' : product.isBloodPack ? '预约服务' : '可采购',
      lowStock: product.stock <= 5,
      leadText: product.isBloodPack ? '可预约' : product.stock <= 5 ? '库存紧张' : '可采购',
    }))

    const quickFilters = this.getQuickFilters(mappedProducts, isInstitution)
    const activeQuickFilter = quickFilters.some((item: any) => item.key === this.data.activeQuickFilter)
      ? this.data.activeQuickFilter
      : 'all'

    this.setData({
      quickFilters,
      activeQuickFilter,
      allProducts: mappedProducts,
      products: this.filterWithSearch(mappedProducts, activeQuickFilter, this.data.searchKeyword),
      emptyText: this.getEmptyText(activeQuickFilter, this.data.searchKeyword),
    })
  },

  getQuickFilters(products: any[], isInstitution: boolean) {
    const filters = [
      { key: 'all', label: '全部', count: products.length },
      { key: 'common', label: '常购', count: products.filter((item: any) => !item.isBloodPack).length },
      { key: 'low', label: '低库存', count: products.filter((item: any) => item.lowStock).length },
    ]

    if (isInstitution) {
      filters.splice(2, 0, {
        key: 'blood',
        label: '预约服务',
        count: products.filter((item: any) => item.isBloodPack).length,
      })
      filters.push({
        key: 'institution',
        label: '机构专区',
        count: products.filter((item: any) => item.visibility === 'institution_only').length,
      })
    }

    return filters
  },

  filterProducts(products: any[], filterKey: string) {
    if (filterKey === 'blood') return products.filter((item: any) => item.isBloodPack)
    if (filterKey === 'low') return products.filter((item: any) => item.lowStock)
    if (filterKey === 'institution') return products.filter((item: any) => item.visibility === 'institution_only')
    if (filterKey === 'common') return products.filter((item: any) => !item.isBloodPack)
    return products
  },

  filterWithSearch(products: any[], filterKey: string, keyword: string) {
    let result = this.filterProducts(products, filterKey)
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      result = result.filter((item: any) => item.name.toLowerCase().includes(kw))
    }
    return result
  },

  getEmptyText(filterKey: string, keyword: string) {
    if (keyword.trim()) return '未找到匹配商品'
    if (filterKey === 'blood') return '当前分类暂无可预约服务'
    return '当前分类暂无商品'
  },

  onSearchInput(e: any) {
    const keyword = e.detail.value
    this.setData({
      searchKeyword: keyword,
      keywordMode: !!keyword.trim(),
    })
  },

  onSearchConfirm(e: any) {
    const keyword = (e?.detail?.value ?? this.data.searchKeyword ?? '').trim()
    this.setData({
      activeCategory: keyword ? '' : (this.data.activeCategory || this.data.categories[0]?.id || ''),
      searchKeyword: keyword,
      keywordMode: !!keyword,
    })
    this.loadProducts()
  },

  onSearchClear() {
    this.setData({
      activeCategory: this.data.categories[0]?.id || '',
      searchKeyword: '',
      keywordMode: false,
    })
    this.loadProducts()
  },

  onCategoryTap(e: any) {
    this.setData({ activeCategory: e.currentTarget.dataset.id })
    this.loadProducts()
  },

  onQuickFilterTap(e: any) {
    const filterKey = e.currentTarget.dataset.key
    this.setData({
      activeQuickFilter: filterKey,
      products: this.filterWithSearch(this.data.allProducts, filterKey, this.data.searchKeyword),
      emptyText: this.getEmptyText(filterKey, this.data.searchKeyword),
    })
  },

  onProductTap(e: any) {
    wx.navigateTo({ url: `/pages/orders/create/create?productId=${e.currentTarget.dataset.id}` })
  },

  onCartPlusTap(e: any) {
    const id = e.currentTarget.dataset.id
    const product = this.data.allProducts.find((p: any) => p.id === id)
    if (!product) return
    this.setData({
      actionSheetVisible: true,
      actionSheetProduct: { ...product },
    })
  },

  onActionSheetClose() {
    this.setData({ actionSheetVisible: false })
  },

  onActionSheetAddCart(e: any) {
    const { product, quantity } = e.detail
    addToCart(product, quantity)
    this.setData({ actionSheetVisible: false })
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  onActionSheetBuyNow(e: any) {
    const { product } = e.detail
    this.setData({ actionSheetVisible: false })
    wx.navigateTo({ url: `/pages/orders/create/create?productId=${product.id}` })
  },
})

export {}
