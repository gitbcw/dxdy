const { getProductById, createOrder, formatMoney } = require('../../../services/index')

Page({
  data: {
    product: null as any,
    addresses: [] as any[],
    addressOptions: [] as string[],
    selectedAddressIndex: 0,
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
    const addresses = user.addresses || []
    const defaultAddressIndex = Math.max(0, addresses.findIndex((item: any) => item.isDefault))
    const currentAddress = addresses[defaultAddressIndex] || addresses[0]
    const addressText = currentAddress
      ? `${currentAddress.province}${currentAddress.city}${currentAddress.district}${currentAddress.detail}`
      : '暂未配置收货地址'
    const canBooking = !!product.isBloodPack
    const orderType = canBooking ? 'booking' : 'normal'

    this.setData({
      product,
      addresses,
      addressOptions: addresses.map((item: any) => `${item.name} ${item.phone} ${item.province}${item.city}${item.district}${item.detail}`),
      selectedAddressIndex: defaultAddressIndex >= 0 ? defaultAddressIndex : 0,
      unitPrice,
      orderType,
      orderTypeLabel: orderType === 'booking' ? '预约采购' : '普通采购',
      contactName: currentAddress?.name || user.verificationInfo?.contactName || user.nickname,
      contactPhone: currentAddress?.phone || user.verificationInfo?.contactPhone || user.phone,
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
      contactName: address.name,
      contactPhone: address.phone,
    })
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
    const selectedAddress = this.data.addresses[this.data.selectedAddressIndex]

    if (!selectedAddress) {
      wx.showToast({ title: '请选择收货地址', icon: 'none' })
      return
    }

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
      shippingAddress: {
        name: selectedAddress.name,
        phone: selectedAddress.phone,
        full: `${selectedAddress.province}${selectedAddress.city}${selectedAddress.district}${selectedAddress.detail}`,
      },
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
