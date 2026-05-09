const { formatMoney, getProductVisualImage, canPurchase } = require('../../services/index')
const { isStaffRole, normalizePath } = require('../../utils/tab-bar')

const CART_KEY = 'cart_items'

function saveCart(items: any[]) {
  wx.setStorageSync(CART_KEY, items)
}

function loadCart(): any[] {
  try {
    const stored = wx.getStorageSync(CART_KEY)
    if (Array.isArray(stored)) return stored
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
    iconDelete: '',
    iconAdd: '',
    iconMinus: '',
  },

  onShow() {
    if (this.redirectStaffRole()) return
    this.syncTabBar()

    // 每次显示时从 localStorage 重新加载，确保与其他页面的加购操作同步
    const fresh = loadCart()
    cartStore.length = 0
    fresh.forEach((item: any) => cartStore.push(item))
    this.refreshCart()
  },

  syncTabBar() {
    const tabBar = (this as any).getTabBar?.()
    tabBar?.updateForPage?.(normalizePath('/pages/cart/cart'))
  },

  redirectStaffRole() {
    const role = getApp().globalData.userRole || 'customer_personal'
    if (!isStaffRole(role)) return false

    wx.switchTab({ url: '/pages/home/home' })
    return true
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
          specText: item.specs?.[0]?.value || '标准规格',
          imageUrl: item.imageUrl || item.productImage || getProductVisualImage(item),
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
    // 预检购物车内所有商品
    for (const item of cartStore) {
      const check = canPurchase(item, user, { quantity: item.quantity })
      if (!check.allowed) {
        wx.showToast({ title: `${item.name || '商品'}：${check.reason}`, icon: 'none', duration: 2500 })
        return
      }
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

export {}
