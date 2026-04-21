const { getProducts, formatMoney } = require('../../../services/index')

Page({
  data: {
    products: [] as any[],
    isInstitution: false,
    isVerified: false,
    isEmpty: false,
  },

  onShow() {
    this.loadBookingProducts()
  },

  async loadBookingProducts() {
    const user = getApp().globalData.userInfo
    const isInstitution = user?.customerType === 'institution'
    const isVerified = user?.verificationStatus === 'approved'

    if (!isInstitution || !isVerified) {
      this.setData({
        products: [],
        isInstitution,
        isVerified,
        isEmpty: false,
      })
      return
    }

    const products = await getProducts({ visibility: 'all', categoryId: 'cat_blood' })
    const bookingProducts = products
      .filter((item: any) => item.isBloodPack && (item.visibility === 'institution_only' || item.visibility === 'all'))
      .map((item: any) => ({
        ...item,
        priceText: formatMoney(item.institutionPrice || item.personalPrice || 0),
        specText: item.specs?.[0]?.value || '标准规格',
        stockText: item.stock <= 5 ? `库存紧张 · 剩余 ${item.stock}` : `库存 ${item.stock}`,
      }))

    this.setData({
      products: bookingProducts,
      isInstitution,
      isVerified,
      isEmpty: bookingProducts.length === 0,
    })
  },

  onBookTap(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/orders/create/create?productId=${id}` })
  },

  onGoVerify() {
    wx.navigateTo({ url: '/pages/verify/verify' })
  },

  onGoCatalog() {
    wx.switchTab({ url: '/pages/catalog/catalog' })
  },
})

export {}
