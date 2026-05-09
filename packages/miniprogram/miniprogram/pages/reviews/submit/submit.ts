const tracking = require('../../../services/tracking')

Page({
  data: {
    orderId: '',
    productId: '',
    productName: '',
    productImageUrl: '',
    rating: 5,
    content: '',
    stars: [1, 2, 3, 4, 5],
    submitting: false,
  },

  async onLoad(options: any) {
    const { orderId, productId } = options
    if (!orderId || !productId) return

    const db = wx.cloud.database()
    const { data: product } = await db.collection('products').doc(productId).get()

    const { getEffectivePrice, getProductVisualImage } = require('../../../services/index')

    this.setData({
      orderId,
      productId,
      productName: product?.name || '商品',
      productImageUrl: getProductVisualImage(product),
    })
  },

  onStarTap(e: any) {
    const star = e.currentTarget.dataset.star
    this.setData({ rating: star })
  },

  onContentInput(e: any) {
    this.setData({ content: e.detail.value })
  },

  async onSubmit() {
    if (this.data.submitting) return
    if (!this.data.content.trim()) {
      wx.showToast({ title: '请输入评价内容', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'manageReview',
        data: {
          action: 'submitReview',
          orderId: this.data.orderId,
          productId: this.data.productId,
          rating: this.data.rating,
          content: this.data.content,
          images: [],
        },
      }) as any

      if (!result?.success) {
        wx.showToast({ title: result?.error || '评价失败', icon: 'none' })
        return
      }

      tracking.trackReviewSubmit(this.data.productId, this.data.orderId, this.data.rating)
      wx.showToast({ title: '评价成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 700)
    } catch (err: any) {
      wx.showToast({ title: err?.message || '评价失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },
})

export {}
