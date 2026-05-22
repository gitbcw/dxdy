const { formatMoney, getProductVisualImage, canPurchase, requireBoundPhone, getCartItems, clearCart, updateCartItem, removeCartItem } = require('../../services/index')
const { isStaffRole, normalizePath } = require('../../utils/tab-bar')
const tracking = require('../../services/tracking')

const cartStore: any[] = []

Page({
  data: {
    items: [] as any[],
    total: '0.00',
    isEmpty: true,
    iconDelete: '',
    iconAdd: '',
    iconMinus: '',
  },

  async onShow() {
    if (this.redirectStaffRole()) return
    this.syncTabBar()
    await this.reloadCart()
    tracking.trackPageView('cart', { cartItemCount: cartStore.length })
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

  async reloadCart() {
    try {
      const fresh = await getCartItems()
      cartStore.length = 0
      fresh.forEach((item: any) => cartStore.push(item))
    } catch (err: any) {
      wx.showToast({ title: err?.message || '购物车加载失败', icon: 'none' })
    }
    this.refreshCart()
  },

  refreshCart() {
    const user = getApp().globalData.userInfo
    const isInst = user?.customerType === 'institution'
    const total = cartStore.reduce((s: number, item: any) => {
      const price = item.unitPrice ?? (isInst ? item.institutionPrice : (item.personalPrice || item.institutionPrice))
      return s + price * item.quantity
    }, 0)
    const colors = ['orange', 'purple', 'mint', 'pink']
    this.setData({
      items: cartStore.map((item: any, idx: number) => {
        const price = item.unitPrice ?? (isInst ? item.institutionPrice : (item.personalPrice || item.institutionPrice))
        return {
          ...item,
          lineTotal: formatMoney(price * item.quantity),
          unitPrice: price,
          specText: item.spec || item.specs?.[0]?.value || '标准规格',
          imageUrl: item.imageUrl || item.productImage || getProductVisualImage(item),
          bgColor: item.bgColor || colors[idx % colors.length],
        }
      }),
      total: formatMoney(total),
      isEmpty: cartStore.length === 0,
    })
  },

  clearLocalCart() {
    cartStore.length = 0
    this.refreshCart()
  },

  async onQuantityChange(e: any) {
    const { index, delta } = e.currentTarget.dataset
    const item = cartStore[index]
    if (!item) return

    const nextQuantity = Math.max(1, Number(item.quantity || 1) + Number(delta || 0))
    item.quantity = nextQuantity
    this.refreshCart()

    try {
      const fresh = await updateCartItem(item.productId || item.id || item._id, item.spec || '', nextQuantity)
      cartStore.length = 0
      fresh.forEach((next: any) => cartStore.push(next))
      this.refreshCart()
    } catch (err: any) {
      wx.showToast({ title: err?.message || '数量更新失败', icon: 'none' })
      await this.reloadCart()
    }
  },

  async onRemove(e: any) {
    const index = e.currentTarget.dataset.index
    const item = cartStore[index]
    if (!item) return

    cartStore.splice(index, 1)
    this.refreshCart()

    try {
      const fresh = await removeCartItem(item.productId || item.id || item._id, item.spec || '')
      cartStore.length = 0
      fresh.forEach((next: any) => cartStore.push(next))
      this.refreshCart()
    } catch (err: any) {
      wx.showToast({ title: err?.message || '删除失败', icon: 'none' })
      await this.reloadCart()
    }
  },

  onCartItemTap(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${id}` })
  },

  onCheckout() {
    if (cartStore.length === 0) return
    const user = getApp().globalData.userInfo
    if (!requireBoundPhone(user)) return
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
      success: async (res) => {
        if (res.confirm) {
          cartStore.length = 0
          this.refreshCart()
          await clearCart()
        }
      },
    })
  },

  onShop() {
    wx.switchTab({ url: '/pages/home/home' })
  },
})

export {}
