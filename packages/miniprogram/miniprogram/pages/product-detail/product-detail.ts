const { getProductById, formatMoney, addToCart } = require('../../services/index')

Page({
  _product: null as any,

  data: {
    productName: '',
    price: '0.00',
    spec: '',
    stock: 0,
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
    })
  },

  onAddCart() {
    if (!this._product) return
    addToCart(this._product)
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  onBuyNow() {
    if (!this._product) return
    wx.navigateTo({ url: `/pages/orders/create/create?productId=${this._product.id}` })
  },
})

export {}
