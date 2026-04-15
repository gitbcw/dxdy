const { formatMoney } = require('../../services/index')

// 简易内存购物车
const cartStore: any[] = []

Page({
  data: {
    items: [] as any[],
    total: '0.00',
    isEmpty: true,
  },

  onShow() {
    this.refreshCart()
  },

  refreshCart() {
    const user = getApp().globalData.userInfo
    const isInst = user?.customerType === 'institution'
    const total = cartStore.reduce((s: number, item: any) => {
      const price = isInst ? item.institutionPrice : (item.personalPrice || item.institutionPrice)
      return s + price * item.quantity
    }, 0)
    this.setData({
      items: cartStore.map((item: any) => {
        const price = isInst ? item.institutionPrice : (item.personalPrice || item.institutionPrice)
        return { ...item, lineTotal: formatMoney(price * item.quantity), unitPrice: price }
      }),
      total: formatMoney(total),
      isEmpty: cartStore.length === 0,
    })
  },

  onQuantityChange(e: any) {
    const { index, delta } = e.currentTarget.dataset
    const item = cartStore[index]
    if (!item) return
    item.quantity = Math.max(1, item.quantity + delta)
    this.refreshCart()
  },

  onRemove(e: any) {
    cartStore.splice(e.currentTarget.dataset.index, 1)
    this.refreshCart()
  },

  onCheckout() {
    if (cartStore.length === 0) return
    const user = getApp().globalData.userInfo
    if (!user) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    wx.navigateTo({ url: '/pages/orders/create/create?fromCart=1' })
  },
})

// 导出供其他页面添加商品
export function addToCart(product: any, quantity = 1) {
  const existing = cartStore.find((i: any) => i.id === product.id)
  if (existing) {
    existing.quantity += quantity
  } else {
    cartStore.push({ ...product, quantity })
  }
}

export function getCartItems() {
  return [...cartStore]
}

export function clearCart() {
  cartStore.length = 0
}
