const { getProductById, createOrder, getCartItems, clearCart, formatMoney, getProductVisualImage, getAvailableCoupons, calculateCouponDiscount } = require('../../../services/index')

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
    addressName: '请选择收货人',
    addressPhone: '',
    customerTypeLabel: '个人客户',
    priceLabel: '零售价',
    canBooking: false,
    isBloodProduct: false,
    policyText: '',
    primaryButtonText: '提交订单',
    specText: '标准规格',
    productImageUrl: '',
    availableCoupons: [] as any[],
    selectedCoupon: null as any,
    couponDiscount: 0,
    couponText: '加载中...',
    isUrgent: false,
    urgentFee: 0,
    urgentDescription: '',
    canUrgent: false,
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
      addressName: currentAddress?.name || '请选择收货人',
      addressPhone: currentAddress?.phone || '',
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
        return {
          ...item,
          unitPrice: price,
          lineTotal: formatMoney(price * item.quantity),
          specText: item.specs?.[0]?.value || '标准规格',
          imageUrl: getProductVisualImage(item),
        }
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
      const urgentConfig = product.urgentConfig
      const canUrgent = !!(product.isBloodPack && urgentConfig && urgentConfig.enabled)

      this.setData({
        ...sharedData,
        product,
        isFromCart: false,
        unitPrice,
        specText: product.specs?.[0]?.value || '标准规格',
        orderType,
        orderTypeLabel: orderType === 'booking' ? '预约采购' : '普通采购',
        canBooking,
        isBloodProduct: !!product.isBloodPack,
        productImageUrl: getProductVisualImage(product),
        policyText: product.returnPolicy?.note || '以商品详情页说明为准',
        primaryButtonText: orderType === 'booking' ? '提交预约' : '提交订单',
        canUrgent,
        urgentFee: canUrgent ? (urgentConfig.extraFee || 0) : 0,
        urgentDescription: canUrgent ? (urgentConfig.description || '优先调配与配送') : '',
      })
      this.calcTotal()
    }

    // 加载可用优惠券
    this._loadCoupons()
  },

  async _loadCoupons() {
    try {
      const coupons = await getAvailableCoupons()
      this.setData({
        availableCoupons: coupons,
        couponText: coupons.length > 0 ? `${coupons.length} 张可用` : '暂无可用',
      })
    } catch {
      this.setData({ couponText: '暂无可用' })
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

  onUrgentToggle(e: any) {
    const isUrgent = e.detail.value
    this.setData({ isUrgent })
    this.calcTotal()
  },

  onAddressChange(e: any) {
    const index = Number(e.detail.value)
    const address = this.data.addresses[index]
    if (!address) return
    this.setData({
      selectedAddressIndex: index,
      addressText: `${address.province}${address.city}${address.district}${address.detail}`,
      addressName: address.name,
      addressPhone: address.phone,
    })
  },

  calcTotal() {
    let total = this.data.unitPrice * this.data.quantity
    if (this.data.isUrgent) total += this.data.urgentFee
    let discount = 0
    if (this.data.selectedCoupon) {
      const result = calculateCouponDiscount(
        this.data.selectedCoupon,
        [{ productId: this.data.product?.id, totalPrice: total }],
        total,
      )
      if (result.canUse) {
        discount = result.discountAmount
      }
    }
    this.setData({
      total: formatMoney(Math.max(0.01, total - discount)),
      couponDiscount: discount,
    })
  },

  onCouponTap() {
    const coupons = this.data.availableCoupons
    if (coupons.length === 0) {
      wx.showToast({ title: '暂无可用优惠券', icon: 'none' })
      return
    }
    const items = ['不使用优惠券', ...coupons.map((c: any) => {
      const valueText = c.couponType === 'fixed' ? `减¥${c.couponValue}`
        : c.couponType === 'discount' ? `${c.couponValue}折`
        : `满${c.minAmount}减${c.couponValue}`
      return `${c.couponName} (${valueText})`
    })]
    const currentIndex = this.data.selectedCoupon
      ? coupons.findIndex((c: any) => c.id === this.data.selectedCoupon.id) + 1
      : 0
    wx.showActionSheet({
      itemList: items,
      success: (res: any) => {
        if (res.tapIndex === 0) {
          this.setData({ selectedCoupon: null, couponDiscount: 0 })
        } else {
          const coupon = coupons[res.tapIndex - 1]
          this.setData({ selectedCoupon: coupon })
        }
        this.calcTotal()
        this.setData({
          couponText: this.data.selectedCoupon
            ? `已选 1 张，优惠 ¥${formatMoney(this.data.couponDiscount)}`
            : `${coupons.length} 张可用`,
        })
      },
    })
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
          productImage: getProductVisualImage(item),
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
        productImage: getProductVisualImage(product),
        spec: product.specs?.[0]?.value ?? '',
        quantity,
        unitPrice: this.data.unitPrice,
        totalPrice: this.data.unitPrice * quantity,
      }]
    }

    try {
      wx.showLoading({ title: '提交中...' })
      const order = await createOrder({
        customerId: user.id,
        type: this.data.isFromCart ? 'normal' : this.data.orderType,
        items: orderItems,
        isUrgent: this.data.isUrgent,
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
        couponId: this.data.selectedCoupon?.id || undefined,
      })
      wx.hideLoading()
      if (this.data.isFromCart) clearCart()
      const label = (!this.data.isFromCart && this.data.orderType === 'booking') ? '预约已提交' : '订单已提交'
      wx.showToast({ title: label, icon: 'success' })
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/orders/order-detail/order-detail?id=${order.id}` })
      }, 700)
    } catch (err: any) {
      wx.hideLoading()
      wx.showToast({ title: err?.message || '提交失败', icon: 'none' })
    }
  },
})

export {}
