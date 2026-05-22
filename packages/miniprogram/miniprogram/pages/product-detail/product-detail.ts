const { getProductById, formatMoney, addToCart, getProductVisualImage, canPurchase, isOnPromotion, getEffectivePrice, requireBoundPhone } = require('../../services/index')
const tracking = require('../../services/tracking')

Page({
  _product: null as any,
  _countdownTimer: null as any,

  data: {
    productName: '',
    price: '0.00',
    originalPrice: '',
    isOnPromotion: false,
    promotionCountdown: '',
    spec: '',
    stock: 0,
    isBloodProduct: false,
    isCardVoucher: false,
    bloodType: '按商品标注',
    productImageUrl: '',
    reviews: [] as any[],
    averageRating: 0,
    reviewCount: 0,
  },

  async onLoad(options: any) {
    if (!options.id) return
    const product = await getProductById(options.id)
    if (!product) return

    this._product = product

    const app = getApp()
    const user = app.globalData.userInfo
    const isInst = user?.customerType === 'institution'
    const onPromo = isOnPromotion(product)

    let price: number
    let originalPrice = ''

    if (onPromo) {
      price = Number(product.promotionPrice)
      originalPrice = formatMoney(getEffectivePrice(product, isInst ? 'institution' : 'personal'))
    } else {
      price = isInst ? product.institutionPrice : (product.personalPrice || product.institutionPrice)
    }

    this.setData({
      productName: product.name,
      price: formatMoney(price),
      originalPrice,
      isOnPromotion: onPromo,
      spec: product.specs?.[0]?.value || '标准规格',
      stock: product.stock,
      isBloodProduct: !!product.isBloodPack,
      isCardVoucher: product.productType === 'card_voucher',
      bloodType: product.specs?.find((item: any) => item.name === '血型')?.value || (product.isBloodPack ? '需指定' : '不适用'),
      productImageUrl: getProductVisualImage(product),
    })

    if (onPromo) this.startCountdown(product.promotionEnd)
    this._loadReviews(product.id || product._id)
    tracking.trackProductView(product.id || product._id, product.name, price, product.isBloodPack ? 'blood' : 'normal')
  },

  async _loadReviews(productId: string) {
    try {
      const db = wx.cloud.database()
      const { data } = await db.collection('product_reviews')
        .where({ productId, status: 'approved' })
        .orderBy('createdAt', 'desc')
        .limit(20).get()
      const reviews = (data || []).map((r: any) => ({
        ...r,
        ratingStars: '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating),
        dateText: (r.createdAt || '').slice(0, 10),
      }))
      const avg = reviews.length > 0
        ? Math.round(reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length * 10) / 10
        : 0
      this.setData({ reviews, averageRating: avg, reviewCount: reviews.length })
    } catch (_e) { /* skip */ }
  },

  onUnload() {
    if (this._countdownTimer) clearInterval(this._countdownTimer)
  },

  startCountdown(endStr: string) {
    const update = () => {
      const end = new Date(endStr.replace(/-/g, '/'))
      const diff = end.getTime() - Date.now()
      if (diff <= 0) {
        this.setData({ isOnPromotion: false, promotionCountdown: '', originalPrice: '' })
        clearInterval(this._countdownTimer)
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      this.setData({ promotionCountdown: `${h}时${m}分${s}秒` })
    }
    update()
    this._countdownTimer = setInterval(update, 1000)
  },

  async onAddCart() {
    if (!this._product) return
    if (this._product.productType === 'card_voucher') {
      wx.showToast({ title: '卡券商品请直接购买', icon: 'none' })
      return
    }
    const user = getApp().globalData.userInfo
    const check = canPurchase(this._product, user)
    if (!check.allowed) { wx.showToast({ title: check.reason, icon: 'none' }); return }
    await addToCart(this._product)
    ;(this as any).selectComponent?.('#floatingActions')?.refresh?.()
    tracking.trackAddToCart(this._product.id, this._product.name, this.data.price, 1, 'product-detail')
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  onBuyNow() {
    if (!this._product) return
    const user = getApp().globalData.userInfo
    if (!requireBoundPhone(user)) return
    const check = canPurchase(this._product, user)
    if (!check.allowed) { wx.showToast({ title: check.reason, icon: 'none' }); return }
    wx.navigateTo({ url: `/pages/orders/create/create?productId=${this._product.id}` })
  },

  onTestQuery() {
    wx.navigateTo({ url: '/pages/tests/query/query' })
  },

  onServiceTap() {
    wx.navigateTo({ url: '/pages/mine/help/help' })
  },
})

export {}
