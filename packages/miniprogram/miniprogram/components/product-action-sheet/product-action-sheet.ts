const { formatMoney } = require('../../services/index')

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
    },
    product: {
      type: Object,
      value: {},
    },
    isInstitution: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    quantity: 1,
    selectedSpecIdx: 0,
    displayPrice: '',
    stock: 0,
    productName: '',
    specs: [] as { name: string; value: string }[],
  },

  observers: {
    'product': function (product: any) {
      if (!product || !product.id) {
        this.setData({
          displayPrice: '',
          stock: 0,
          productName: '',
          specs: [],
          quantity: 1,
          selectedSpecIdx: 0,
        })
        return
      }
      const isInst = this.data.isInstitution
      const price = isInst
        ? product.institutionPrice
        : (product.personalPrice || product.institutionPrice)
      this.setData({
        displayPrice: '¥' + formatMoney(price || 0),
        stock: product.stock || 0,
        productName: product.name || '',
        specs: product.specs || [],
        quantity: 1,
        selectedSpecIdx: 0,
      })
    },
  },

  methods: {
    onClose() {
      this.triggerEvent('close')
    },

    onSpecTap(e: any) {
      this.setData({ selectedSpecIdx: Number(e.currentTarget.dataset.idx) })
    },

    onQtyMinus() {
      if (this.data.quantity > 1) {
        this.setData({ quantity: this.data.quantity - 1 })
      }
    },

    onQtyPlus() {
      if (this.data.quantity < this.data.stock) {
        this.setData({ quantity: this.data.quantity + 1 })
      }
    },

    onAddCart() {
      const product = this.properties.product
      if (!product || !product.id) return
      this.triggerEvent('addcart', {
        product,
        quantity: this.data.quantity,
      })
    },

    onBuyNow() {
      const product = this.properties.product
      if (!product || !product.id) return
      this.triggerEvent('buynow', {
        product,
        quantity: this.data.quantity,
      })
    },
  },
})

export {}
