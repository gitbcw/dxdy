const { formatMoney } = require('../../services/index')
const icons = require('../../services/icons')

const CART_KEY = 'cart_items'

function saveCart(items: any[]) {
  wx.setStorageSync(CART_KEY, items)
}

function loadCart(): any[] {
  try {
    const stored = wx.getStorageSync(CART_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

const cartStore: any[] = loadCart()

Page({
  data: {
    items: [] as any[],
    total: '0.00',
    isEmpty: true,
    iconDelete: icons.delete,
    iconAdd: icons.add,
    iconMinus: icons.minus,
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
    const colors = ['orange', 'purple', 'mint', 'pink']
    this.setData({
      items: cartStore.map((item: any, idx: number) => {
        const price = isInst ? item.institutionPrice : (item.personalPrice || item.institutionPrice)
        return {
          ...item,
          lineTotal: formatMoney(price * item.quantity),
          unitPrice: price,
          bgColor: item.bgColor || colors[idx % colors.length]
        }
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
    saveCart(cartStore)
    this.refreshCart()
  },

  onRemove(e: any) {
    cartStore.splice(e.currentTarget.dataset.index, 1)
    saveCart(cartStore)
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

  onClearCart() {
    if (cartStore.length === 0) return
    wx.showModal({
      title: '清空购物车',
      content: '确定要清空购物车吗？',
      confirmColor: '#0A6E7C',
      success: (res) => {
        if (res.confirm) {
          cartStore.length = 0
          saveCart(cartStore)
          this.refreshCart()
        }
      }
    })
  },

  onShop() {
    wx.switchTab({ url: '/pages/home/home' })
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
  saveCart(cartStore)
}

export function getCartItems() {
  return [...cartStore]
}

export function clearCart() {
  cartStore.length = 0
  saveCart(cartStore)
}
