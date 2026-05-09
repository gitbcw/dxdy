const { getProductById, formatMoney, addToCart, getProductVisualImage, canPurchase } = require('../../services/index')

Page({
  _product: null as any,

  data: {
    productName: '',
    price: '0.00',
    spec: '',
    stock: 0,
    isBloodProduct: false,
    bloodType: '按商品标注',
    productImageUrl: '',
  },

  async onLoad(options: any) {
    if (!options.id) return
    const product = await getProductById(options.id)
    if (!product) return

    this._product = product

    const app = getApp()
    const user = app.globalData.userInfo
    const isInst = user?.customerType === 'institution'
    const price = isInst ? product.institutionPrice : (product.personalPrice || product.institutionPrice)

    this.setData({
      productName: product.name,
      price: formatMoney(price),
      spec: product.specs?.[0]?.value || '标准规格',
      stock: product.stock,
      isBloodProduct: !!product.isBloodPack,
      bloodType: product.specs?.find((item: any) => item.name === '血型')?.value || (product.isBloodPack ? '需指定' : '不适用'),
      productImageUrl: getProductVisualImage(product),
    })
  },

  onAddCart() {
    if (!this._product) return
    const user = getApp().globalData.userInfo
    const check = canPurchase(this._product, user)
    if (!check.allowed) { wx.showToast({ title: check.reason, icon: 'none' }); return }
    addToCart(this._product)
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  onBuyNow() {
    if (!this._product) return
    const user = getApp().globalData.userInfo
    const check = canPurchase(this._product, user)
    if (!check.allowed) { wx.showToast({ title: check.reason, icon: 'none' }); return }
    wx.navigateTo({ url: `/pages/orders/create/create?productId=${this._product.id}` })
  },

  onTestQuery() {
    wx.navigateTo({ url: '/pages/tests/query/query' })
  },
})

export {}
