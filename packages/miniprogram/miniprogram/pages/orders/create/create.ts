const { getProductById, createOrder, formatMoney } = require('../../../services/index')

Page({
  data: {
    product: null as any,
    quantity: 1,
    unitPrice: 0,
    total: '0.00',
    remark: '',
  },

  async onLoad(options: any) {
    const user = getApp().globalData.userInfo
    if (!user) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    if (options.productId) {
      const product = await getProductById(options.productId)
      if (product) {
        const isInst = user.customerType === 'institution'
        const price = isInst ? product.institutionPrice : (product.personalPrice || product.institutionPrice)
        this.setData({ product, unitPrice: price })
        this.calcTotal()
      }
    }
  },

  onQuantityChange(e: any) {
    const delta = e.currentTarget.dataset.delta
    this.setData({ quantity: Math.max(1, this.data.quantity + delta) })
    this.calcTotal()
  },

  calcTotal() {
    const total = this.data.unitPrice * this.data.quantity
    this.setData({ total: formatMoney(total) })
  },

  onRemarkInput(e: any) {
    this.setData({ remark: e.detail.value })
  },

  async onSubmit() {
    const { product, quantity, remark } = this.data
    const user = getApp().globalData.userInfo
    if (!product || !user) return

    wx.showLoading({ title: '提交中...' })
    const order = await createOrder({
      customerId: user.id,
      type: 'normal',
      items: [{
        productId: product.id,
        productName: product.name,
        productImage: '',
        spec: product.specs[0]?.value ?? '',
        quantity,
        unitPrice: this.data.unitPrice,
        totalPrice: this.data.unitPrice * quantity,
      }],
      remark,
    })
    wx.hideLoading()

    if (order) {
      wx.showToast({ title: '下单成功', icon: 'success' })
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/orders/order-detail/order-detail?list=1' })
      }, 1000)
    }
  },
})
