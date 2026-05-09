const icons = require('../../services/icons')

const CART_KEY = 'cart_items'

function getCartCount() {
  try {
    const stored = wx.getStorageSync(CART_KEY)
    const items = Array.isArray(stored) ? stored : stored ? JSON.parse(stored) : []
    return items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0)
  } catch {
    return 0
  }
}

Component({
  properties: {
    showCart: { type: Boolean, value: false },
    showService: { type: Boolean, value: false },
  },

  data: {
    cartIcon: icons.cart,
    serviceIcon: icons.service,
    cartCount: 0,
  },

  pageLifetimes: {
    show() {
      this.refresh()
    },
  },

  lifetimes: {
    attached() {
      this.refresh()
    },
  },

  methods: {
    refresh() {
      this.setData({ cartCount: getCartCount() })
    },

    onCartTap() {
      wx.switchTab({ url: '/pages/cart/cart' })
    },

    onServiceTap() {
      wx.navigateTo({ url: '/pages/mine/help/help' })
    },
  },
})

export {}
