const icons = require('../../services/icons')
const { getCartItems } = require('../../services/index')

async function getCartCount() {
  try {
    const items = await getCartItems()
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
    async refresh() {
      this.setData({ cartCount: await getCartCount() })
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
