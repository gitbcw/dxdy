const { getProductById, createOrder, getCartItems, clearCart, formatMoney } = require('../../../services/index')

const CART_KEY = 'cart_items'

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDefaultBookingDate() {
  const date = new Date()
  date.setDate(date.getDate() + 2)
  return formatDate(date)
}

function loadCartItems(): any[] {
  try {
    const stored = wx.getStorageSync(CART_KEY)
    if (Array.isArray(stored)) return stored
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

Page({
  data: {
    product: null as any,
    cartItems: [] as any[],
    isFromCart: false,
    addresses: [] as any[],
    addressOptions: [] as string[],
    selectedAddressIndex: 0,
    quantity: 1,
    unitPrice: 0,
    total: '0.00',
    remark: '',
    orderType: 'normal',
    orderTypeLabel: '普通采购',
    bookingDate: getDefaultBookingDate(),
    minBookingDate: formatDate(new Date()),
    bookingLocation: '上海宠物血液中心',
    payMethod: 'wechat',
    addressText: '',
    customerTypeLabel: '个人客户',
    priceLabel: '零售价',
    canBooking: false,
    isBloodProduct: false,
    policyText: '',
    primaryButtonText: '提交订单',
  },

  _cartRaw: [] as any[],

  async onLoad(options: any) {
    const user = getApp().globalData.userInfo
    if (!user) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }

    const isInstitution = user.customerType === 'institution'
    const addresses = user.addresses || []
    const defaultAddressIndex = Math.max(0, addresses.findIndex((item: any) => item.isDefault))
    const currentAddress = addresses[defaultAddressIndex] || addresses[0]
    const addressText = currentAddress
      ? `${currentAddress.province}${currentAddress.city}${currentAddress.district}${currentAddress.detail}`
      : '暂未配置收货地址'

    // 公共地址/联系人数据
    const sharedData = {
      addresses,
      addressOptions: addresses.map((item: any) => `${item.name} ${item.phone} ${item.province}${item.city}${item.district}${item.detail}`),
      selectedAddressIndex: defaultAddressIndex >= 0 ? defaultAddressIndex : 0,
      addressText,
      customerTypeLabel: isInstitution ? '宠物医院客户' : '个人宠物客户',
      priceLabel: isInstitution ? '机构价' : '零售价',
    }

    if (options.fromCart === '1') {
      // 购物车结算
      const items = loadCartItems()
      if (items.length === 0) return
      this._cartRaw = items

      const displayItems = items.map((item: any) => {
        const price = isInstitution ? item.institutionPrice : (item.personalPrice || item.institutionPrice)
        return { ...item, unitPrice: price, lineTotal: formatMoney(price * item.quantity) }
      })
      const total = items.reduce((s: number, item: any) => {
        const price = isInstitution ? item.institutionPrice : (item.personalPrice || item.institutionPrice)
        return s + price * item.quantity
      }, 0)

      this.setData({
        ...sharedData,
        isFromCart: true,
        cartItems: displayItems,
        total: formatMoney(total),
        primaryButtonText: '提交订单',
      })
    } else {
      // 单品下单
      if (!options.productId) return
      const product = await getProductById(options.productId)
      if (!product) return

      const unitPrice = isInstitution
        ? product.institutionPrice
        : (product.personalPrice || product.institutionPrice)
      const canBooking = !!product.isBloodPack
      const orderType = canBooking ? 'booking' : 'normal'

      this.setData({
        ...sharedData,
        product,
        isFromCart: false,
        unitPrice,
        orderType,
        orderTypeLabel: orderType === 'booking' ? '预约采购' : '普通采购',
        canBooking,
        isBloodProduct: !!product.isBloodPack,
        policyText: product.returnPolicy?.note || '以商品详情页说明为准',
        primaryButtonText: orderType === 'booking' ? '提交预约' : '提交订单',
      })
      this.calcTotal()
    }
  },

  onQuantityChange(e: any) {
    const delta = e.currentTarget.dataset.delta
    const next = Math.max(1, this.data.quantity + delta)
    this.setData({ quantity: next })
    this.calcTotal()
  },

  onRemarkInput(e: any) {
    this.setData({ remark: e.detail.value })
  },

  onBookingInput(e: any) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  onBookingDateChange(e: any) {
    this.setData({ bookingDate: e.detail.value })
  },

  onPayMethodChange(e: any) {
    this.setData({ payMethod: e.currentTarget.dataset.method })
  },

  onAddressChange(e: any) {
    const index = Number(e.detail.value)
    const address = this.data.addresses[index]
    if (!address) return
    this.setData({
      selectedAddressIndex: index,
      addressText: `${address.province}${address.city}${address.district}${address.detail}`,
    })
  },

  calcTotal() {
    const total = this.data.unitPrice * this.data.quantity
    this.setData({ total: formatMoney(total) })
  },

  async onSubmit() {
    const user = getApp().globalData.userInfo
    if (!user) return
    const selectedAddress = this.data.addresses[this.data.selectedAddressIndex]

    if (!selectedAddress) {
      wx.showToast({ title: '请选择收货地址', icon: 'none' })
      return
    }

    const shippingAddress = {
      name: selectedAddress.name,
      phone: selectedAddress.phone,
      full: `${selectedAddress.province}${selectedAddress.city}${selectedAddress.district}${selectedAddress.detail}`,
    }

    let orderItems: any[]

    if (this.data.isFromCart) {
      const isInstitution = user.customerType === 'institution'
      orderItems = this._cartRaw.map((item: any) => {
        const price = isInstitution ? item.institutionPrice : (item.personalPrice || item.institutionPrice)
        return {
          productId: item.id,
          productName: item.name,
          productImage: '',
          spec: item.specs?.[0]?.value ?? '',
          quantity: item.quantity,
          unitPrice: price,
          totalPrice: price * item.quantity,
        }
      })
    } else {
      const { product, quantity, orderType } = this.data
      if (!product) return

      const { bookingDate, bookingLocation } = this.data
      if (orderType === 'booking' && (!bookingDate || !bookingLocation)) {
        wx.showToast({ title: '请补全预约信息', icon: 'none' })
        return
      }

      orderItems = [{
        productId: product.id,
        productName: product.name,
        productImage: '',
        spec: product.specs?.[0]?.value ?? '',
        quantity,
        unitPrice: this.data.unitPrice,
        totalPrice: this.data.unitPrice * quantity,
      }]
    }

    wx.showLoading({ title: '提交中...' })
    const order = await createOrder({
      customerId: user.id,
      type: this.data.isFromCart ? 'normal' : this.data.orderType,
      items: orderItems,
      booking: (!this.data.isFromCart && this.data.orderType === 'booking')
        ? {
            date: this.data.bookingDate,
            location: this.data.bookingLocation,
            contactName: selectedAddress.name,
            contactPhone: selectedAddress.phone,
          }
        : undefined,
      shippingAddress,
      remark: this.data.remark,
    })
    wx.hideLoading()

    if (order) {
      if (this.data.isFromCart) clearCart()
      const label = (!this.data.isFromCart && this.data.orderType === 'booking') ? '预约已提交' : '下单成功'
      wx.showToast({ title: label, icon: 'success' })
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/orders/order-detail/order-detail?id=${order.id}` })
      }, 700)
    }
  },
})

export {}
