const { getProductById, createOrder, formatMoney } = require('../../../services/index')

Page({
  data: {
    product: null as any,
    quantity: 1,
    unitPrice: 0,
    total: '0.00',
    remark: '',
    orderType: 'normal',
    orderTypeLabel: '普通采购',
    contactName: '',
    contactPhone: '',
    bookingDate: '2026-04-22',
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

  async onLoad(options: any) {
    const user = getApp().globalData.userInfo
    if (!user) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }

    if (!options.productId) return

    const product = await getProductById(options.productId)
    if (!product) return

    const isInstitution = user.customerType === 'institution'
    const unitPrice = isInstitution
      ? product.institutionPrice
      : (product.personalPrice || product.institutionPrice)
    const defaultAddress = user.addresses?.find((item: any) => item.isDefault) || user.addresses?.[0]
    const addressText = defaultAddress
      ? `${defaultAddress.province}${defaultAddress.city}${defaultAddress.district}${defaultAddress.detail}`
      : '暂未配置默认地址'
    const canBooking = !!product.isBloodPack || product.category === 'cat_service'
    const orderType = canBooking ? 'booking' : 'normal'

    this.setData({
      product,
      unitPrice,
      orderType,
      orderTypeLabel: orderType === 'booking' ? '预约服务' : '普通采购',
      contactName: defaultAddress?.name || user.verificationInfo?.contactName || user.nickname,
      contactPhone: defaultAddress?.phone || user.verificationInfo?.contactPhone || user.phone,
      addressText,
      customerTypeLabel: isInstitution ? '宠物医院客户' : '个人宠物客户',
      priceLabel: isInstitution ? '机构价' : '零售价',
      canBooking,
      isBloodProduct: !!product.isBloodPack,
      policyText: product.returnPolicy?.note || '以商品详情页说明为准',
      primaryButtonText: orderType === 'booking' ? '提交预约' : '提交订单',
    })
    this.calcTotal()
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

  onContactInput(e: any) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  onBookingInput(e: any) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  onSwitchOrderType(e: any) {
    const orderType = e.currentTarget.dataset.type
    if (orderType === 'booking' && !this.data.canBooking) return
    this.setData({
      orderType,
      orderTypeLabel: orderType === 'booking' ? '预约服务' : '普通采购',
      primaryButtonText: orderType === 'booking' ? '提交预约' : '提交订单',
    })
  },

  onPayMethodChange(e: any) {
    this.setData({ payMethod: e.currentTarget.dataset.method })
  },

  calcTotal() {
    const total = this.data.unitPrice * this.data.quantity
    this.setData({ total: formatMoney(total) })
  },

  async onSubmit() {
    const {
      product,
      quantity,
      remark,
      orderType,
      contactName,
      contactPhone,
      bookingDate,
      bookingLocation,
    } = this.data
    const user = getApp().globalData.userInfo
    if (!product || !user) return

    if (orderType === 'booking' && (!contactName || !contactPhone || !bookingDate || !bookingLocation)) {
      wx.showToast({ title: '请补全预约信息', icon: 'none' })
      return
    }

    wx.showLoading({ title: orderType === 'booking' ? '预约中...' : '提交中...' })
    const order = await createOrder({
      customerId: user.id,
      type: orderType,
      items: [{
        productId: product.id,
        productName: product.name,
        productImage: '',
        spec: product.specs[0]?.value ?? '',
        quantity,
        unitPrice: this.data.unitPrice,
        totalPrice: this.data.unitPrice * quantity,
      }],
      booking: orderType === 'booking'
        ? {
            date: bookingDate,
            location: bookingLocation,
            contactName,
            contactPhone,
          }
        : undefined,
      remark,
    })
    wx.hideLoading()

    if (order) {
      wx.showToast({ title: orderType === 'booking' ? '预约已提交' : '下单成功', icon: 'success' })
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/orders/order-detail/order-detail?id=${order.id}` })
      }, 700)
    }
  },
})

export {}
