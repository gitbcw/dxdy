const { getCategories, getProducts, formatMoney, addToCart, getProductVisualImage, isOnPromotion, getEffectivePrice } = require('../../services/index')
const { isStaffRole, normalizePath } = require('../../utils/tab-bar')
const icons = require('../../services/icons')
const tracking = require('../../services/tracking')

Page({
  data: {
    categories: [] as any[],
    allProducts: [] as any[],
    products: [] as any[],
    activeCategory: '',
    searchKeyword: '',
    quickFilters: [] as any[],
    activeQuickFilter: 'all',
    sortKey: 'comprehensive',
    sortOrder: 'desc',
    emptyText: '当前分类暂无商品',
    isInstitution: false,
    actionSheetVisible: false,
    actionSheetProduct: {} as any,
    keywordMode: false,
    searchSuggestions: [] as any[],
    searchIcon: icons.search,
    filterIcon: icons.filter,
    cartIcon: icons.cart,
    lockIcon: icons.lock,
  },

  onLoad() {
    this.loadCategories()
  },

  onShow() {
    if (this.redirectStaffRole()) return
    this.syncTabBar()
    tracking.trackPageView('catalog')

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

  setCustomTabBarHidden(hidden: boolean) {
    const tabBar = (this as any).getTabBar?.()
    if (tabBar?.setHidden) {
      tabBar.setHidden(hidden)
      return
    }
    tabBar?.setData?.({ hidden })
  },

  redirectStaffRole() {
    const role = getApp().globalData.userRole || 'customer_personal'
    if (!isStaffRole(role)) return false

    wx.switchTab({ url: '/pages/home/home' })
    return true
  },

  async loadCategories() {
    const cats = await getCategories()
    const currentCategory = this.data.activeCategory
    const activeCategory = this.data.searchKeyword.trim()
      ? ''
      : (cats.some((item: any) => item.id === currentCategory) ? currentCategory : '')
    this.setData({ categories: cats, activeCategory })
    this.loadProducts()
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
    const mappedProducts = products.map((product: any, index: number) => {
      const onPromo = isOnPromotion(product)
      const effectivePrice = onPromo ? product.promotionPrice : getEffectivePrice(product, isInstitution ? 'institution' : 'personal')
      return {
        ...product,
        _catalogIndex: index,
        effectivePrice,
        priceText: formatMoney(effectivePrice),
        originalPriceText: onPromo ? formatMoney(getEffectivePrice(product, isInstitution ? 'institution' : 'personal')) : '',
        isPromo: onPromo,
        specText: product.specs?.[0]?.value || '标准规格',
        tagText: product.visibility === 'institution_only' ? '机构专属' : product.isBloodPack ? '预约服务' : '可采购',
        lowStock: product.stock <= 5,
        leadText: product.isBloodPack ? '可预约' : product.stock <= 5 ? '库存紧张' : '',
        salesText: `销量 ${this.getSalesValue(product)}`,
        imageUrl: getProductVisualImage(product),
      }
    })

    const quickFilters = this.getQuickFilters(mappedProducts, isInstitution)
    const activeQuickFilter = quickFilters.some((item: any) => item.key === this.data.activeQuickFilter)
      ? this.data.activeQuickFilter
      : 'all'

    this.setData({
      quickFilters,
      activeQuickFilter,
      allProducts: mappedProducts,
      products: this.applyProductView(mappedProducts, activeQuickFilter, this.data.searchKeyword, this.data.sortKey, this.data.sortOrder),
      emptyText: this.getEmptyText(activeQuickFilter, this.data.searchKeyword),
    })

    if (keyword) {
      tracking.trackSearch(keyword, this.data.products.length)
    }
  },

  getQuickFilters(products: any[], isInstitution: boolean) {
    const filters = [
      { key: 'all', label: '全部', count: products.length },
      { key: 'common', label: '常购', count: products.filter((item: any) => !item.isBloodPack).length },
    ]

    if (isInstitution) {
      filters.push({
        key: 'institution',
        label: '门店专区',
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

  getSalesValue(product: any) {
    return Number(
      product.salesCount ??
      product.soldCount ??
      product.sales ??
      product.sold ??
      product.monthlySales ??
      0
    )
  },

  getComprehensiveValue(product: any) {
    const sortValue = Number(product.sortOrder ?? product.displayOrder ?? product.priority ?? 0)
    if (sortValue) return sortValue
    const time = new Date(String(product.createdAt || product.updatedAt || '').replace(/-/g, '/')).getTime()
    return Number.isFinite(time) ? time : 0
  },

  sortProducts(products: any[], sortKey: string, sortOrder: string) {
    const direction = sortOrder === 'asc' ? 1 : -1
    return [...products].sort((a: any, b: any) => {
      if (sortKey === 'sales') {
        const diff = this.getSalesValue(a) - this.getSalesValue(b)
        if (diff !== 0) return diff * direction
      } else if (sortKey === 'price') {
        const diff = Number(a.effectivePrice || 0) - Number(b.effectivePrice || 0)
        if (diff !== 0) return diff * direction
      } else {
        const diff = this.getComprehensiveValue(a) - this.getComprehensiveValue(b)
        if (diff !== 0) return diff * direction
      }
      return Number(a._catalogIndex || 0) - Number(b._catalogIndex || 0)
    })
  },

  applyProductView(products: any[], filterKey: string, keyword: string, sortKey: string, sortOrder: string) {
    return this.sortProducts(this.filterWithSearch(products, filterKey, keyword), sortKey, sortOrder)
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
      searchSuggestions: this.getSearchSuggestions(keyword),
    })
  },

  onSearchConfirm(e: any) {
    const keyword = (e?.detail?.value ?? this.data.searchKeyword ?? '').trim()
    this.setData({
      activeCategory: keyword ? '' : (this.data.activeCategory || this.data.categories[0]?.id || ''),
      searchKeyword: keyword,
      keywordMode: !!keyword,
      searchSuggestions: [],
    })
    this.loadProducts()
  },

  onSearchClear() {
    this.setData({
      activeCategory: '',
      searchKeyword: '',
      keywordMode: false,
      searchSuggestions: [],
    })
    this.loadProducts()
  },

  onAllCategoryTap() {
    this.setData({
      activeCategory: '',
      keywordMode: !!this.data.searchKeyword.trim(),
    })
    this.loadProducts()
  },

  onCategoryTap(e: any) {
    this.setData({
      activeCategory: e.currentTarget.dataset.id,
      keywordMode: false,
    })
    this.loadProducts()
  },

  onQuickFilterTap(e: any) {
    const filterKey = e.currentTarget.dataset.key
    this.setData({
      activeQuickFilter: filterKey,
      products: this.applyProductView(this.data.allProducts, filterKey, this.data.searchKeyword, this.data.sortKey, this.data.sortOrder),
      emptyText: this.getEmptyText(filterKey, this.data.searchKeyword),
    })
  },

  onSortTap(e: any) {
    const sortKey = e.currentTarget.dataset.key || 'comprehensive'
    const isSameSort = sortKey === this.data.sortKey
    const nextOrder = isSameSort
      ? (this.data.sortOrder === 'asc' ? 'desc' : 'asc')
      : (sortKey === 'price' ? 'asc' : 'desc')
    this.setData({
      sortKey,
      sortOrder: nextOrder,
      products: this.applyProductView(this.data.allProducts, this.data.activeQuickFilter, this.data.searchKeyword, sortKey, nextOrder),
    })
  },

  onFilterTap() {
    const filters = this.data.quickFilters || []
    if (!filters.length) return
    wx.showActionSheet({
      itemList: filters.map((item: any) => item.label),
      success: (res) => {
        const selected = filters[res.tapIndex]
        if (!selected) return
        const filterKey = selected.key
        this.setData({
          activeQuickFilter: filterKey,
          products: this.applyProductView(this.data.allProducts, filterKey, this.data.searchKeyword, this.data.sortKey, this.data.sortOrder),
          emptyText: this.getEmptyText(filterKey, this.data.searchKeyword),
        })
      },
    })
  },

  onProductTap(e: any) {
    wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${e.currentTarget.dataset.id}` })
  },

  getSearchSuggestions(keyword: string) {
    const kw = (keyword || '').trim().toLowerCase()
    if (!kw) return []
    return this.data.allProducts
      .filter((product: any) => {
        const text = `${product.name || ''} ${product.category || ''} ${product.specText || ''}`.toLowerCase()
        return text.includes(kw)
      })
      .slice(0, 6)
      .map((product: any) => ({
        id: product.id,
        title: product.name,
        desc: product.specText || '商品详情',
      }))
  },

  onSearchSuggestionTap(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    this.setData({ searchSuggestions: [], searchKeyword: '' })
    wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${id}` })
  },

  onCartPlusTap(e: any) {
    const id = e.currentTarget.dataset.id
    const product = this.data.allProducts.find((p: any) => p.id === id)
    if (!product) return
    this.setData({
      actionSheetVisible: true,
      actionSheetProduct: {
        ...product,
        imageUrl: product.imageUrl || getProductVisualImage(product),
      },
    })
    this.setCustomTabBarHidden(true)
  },

  onActionSheetClose() {
    this.setData({ actionSheetVisible: false })
    this.setCustomTabBarHidden(false)
  },

  async onActionSheetAddCart(e: any) {
    const { product, quantity } = e.detail
    await addToCart(product, quantity)
    ;(this as any).selectComponent?.('#floatingActions')?.refresh?.()
    this.setData({ actionSheetVisible: false })
    this.setCustomTabBarHidden(false)
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  onActionSheetBuyNow(e: any) {
    const { product } = e.detail
    this.setData({ actionSheetVisible: false })
    this.setCustomTabBarHidden(false)
    wx.navigateTo({ url: `/pages/orders/create/create?productId=${product.id}` })
  },
})

export {}
