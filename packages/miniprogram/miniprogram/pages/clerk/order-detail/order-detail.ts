const icons = require('../../../services/icons')
const { getClerkOrderById, clerkShipOrder, markOrderPreparing, createWxExpressOrder, getProductVisualImage } = require('../../../services/index')

const SELECTED_PICKUP_ADDRESS_KEY = 'selected_pickup_address_id'

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function formatTime(date: Date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

Page({
  data: {
    order: null as any,
    isLoading: true,
    loadError: '',
    showExpressPanel: false,
    showDirectPanel: false,
    showSfPickupPanel: false,
    selectedCompany: '',
    expressNo: '',
    etaDate: '',
    etaTime: '',
    pickupDate: '',
    pickupTime: '',
    senderName: '',
    senderMobile: '',
    senderRegion: [] as string[],
    senderAddress: '',
    selectedPickupAddress: null as any,
    sfWeight: '',
    sfRemark: '',
    cargoName: '宠物医疗用品',
    packageType: '冷藏箱',
    coldChainMethod: '冰袋（2-6°C）',
    packageWeight: '',
    boxTemperature: '',
    expressCompanies: ['顺丰速运', '中通快递', '圆通速递', '韵达快递', '申通快递', '中国邮政'],
    packageTypes: ['冷藏箱', '保温箱', '普通箱'],
    coldChainMethods: ['冰袋（2-6°C）', '干冰', '常温'],
    iconClock: icons.clock,
    iconRefresh: icons.refresh,
  },

  onLoad(e: any) {
    if (e.id) {
      this.loadOrder(e.id)
    } else {
      this.setData({ isLoading: false, loadError: '订单参数缺失' })
    }
  },

  async loadOrder(id: string) {
    this.setData({ isLoading: true, loadError: '' })
    try {
      const order = await getClerkOrderById(id)
      this.setData({
        order: order ? {
          ...order,
          items: (order.items || []).map((item: any) => ({
            ...item,
            imageUrl: item.productImage || getProductVisualImage(item.name || item.productName),
          })),
        } : null,
        isLoading: false,
        loadError: order ? '' : '订单不存在或无权查看',
      })
    } catch (e: any) {
      this.setData({
        order: null,
        isLoading: false,
        loadError: e?.message || '订单加载失败',
      })
    }
  },

  onShow() {
    this.loadSelectedPickupAddress()
  },

  loadSelectedPickupAddress() {
    const user = getApp().globalData.userInfo || wx.getStorageSync('current_user') || {}
    const addresses = Array.isArray(user.pickupAddresses) ? user.pickupAddresses : []
    const selectedId = wx.getStorageSync(SELECTED_PICKUP_ADDRESS_KEY)
    const selected = addresses.find((item: any) => item.id === selectedId)
      || addresses.find((item: any) => item.isDefault)
      || addresses[0]
      || null
    if (!selected) {
      this.setData({ selectedPickupAddress: null })
      return
    }
    this.setData({
      selectedPickupAddress: selected,
      senderName: selected.name || '',
      senderMobile: selected.phone || '',
      senderRegion: [selected.province || '', selected.city || '', selected.district || ''].filter(Boolean),
      senderAddress: selected.detail || '',
    })
  },

  async onStartPreparing() {
    wx.showLoading({ title: '处理中...' })
    try {
      await markOrderPreparing(this.data.order.id)
      wx.hideLoading()
      wx.showToast({ title: '已开始备货', icon: 'success' })
      this.loadOrder(this.data.order.id)
    } catch (e: any) {
      wx.hideLoading()
      wx.showToast({ title: e?.message || '操作失败', icon: 'none' })
    }
  },

  onInputExpress() {
    if (this.data.order?.status !== 'preparing') {
      wx.showToast({ title: '请先开始备货', icon: 'none' })
      return
    }
    if (this.data.order?.isUrgentBooking) {
      const eta = new Date(Date.now() + 60 * 60 * 1000)
      this.setData({
        showDirectPanel: true,
        etaDate: this.data.etaDate || formatDate(eta),
        etaTime: this.data.etaTime || formatTime(eta),
      })
      return
    }
    const pickupAt = new Date(Date.now() + 60 * 60 * 1000)
    this.loadSelectedPickupAddress()
    this.setData({
      showSfPickupPanel: true,
      pickupDate: this.data.pickupDate || formatDate(pickupAt),
      pickupTime: this.data.pickupTime || formatTime(pickupAt),
    })
  },

  onSelectPickupAddress() {
    wx.navigateTo({ url: '/pages/clerk/pickup-address/pickup-address?select=1' })
  },

  onManualExpressTap() {
    this.setData({ showExpressPanel: true, showSfPickupPanel: false })
  },

  onSelectCompany(e: any) {
    this.setData({ selectedCompany: e.currentTarget.dataset.company })
  },

  onExpressNoInput(e: any) {
    this.setData({ expressNo: e.detail.value })
  },

  onPackageTypeTap(e: any) {
    this.setData({ packageType: e.currentTarget.dataset.value })
  },

  onColdChainTap(e: any) {
    this.setData({ coldChainMethod: e.currentTarget.dataset.value })
  },

  onColdFieldInput(e: any) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  onEtaDateChange(e: any) {
    this.setData({ etaDate: e.detail.value })
  },

  onEtaTimeChange(e: any) {
    this.setData({ etaTime: e.detail.value })
  },

  onPickupDateChange(e: any) {
    this.setData({ pickupDate: e.detail.value })
  },

  onPickupTimeChange(e: any) {
    this.setData({ pickupTime: e.detail.value })
  },

  onSenderRegionChange(e: any) {
    this.setData({ senderRegion: e.detail.value || [] })
  },

  onSenderFieldInput(e: any) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  async onSubmitSfPickup() {
    const pickupAddress = this.data.selectedPickupAddress
    if (!pickupAddress) {
      wx.showToast({ title: '请先选择揽收地址', icon: 'none' })
      return
    }
    if (!pickupAddress.name || !pickupAddress.phone || !pickupAddress.province || !pickupAddress.city || !pickupAddress.district || !pickupAddress.detail) {
      wx.showToast({ title: '揽收地址信息不完整', icon: 'none' })
      return
    }
    if (!/^1\d{10}$/.test(String(pickupAddress.phone).trim())) {
      wx.showToast({ title: '揽收手机号无效', icon: 'none' })
      return
    }
    if (!this.data.pickupDate || !this.data.pickupTime) {
      wx.showToast({ title: '请选择揽收时间', icon: 'none' })
      return
    }
    const weight = Number(this.data.sfWeight)
    if (!Number.isFinite(weight) || weight <= 0) {
      wx.showToast({ title: '请填写包裹重量', icon: 'none' })
      return
    }
    wx.showLoading({ title: '预约中...' })
    try {
      await createWxExpressOrder({
        orderId: this.data.order.id,
        senderName: pickupAddress.name.trim(),
        senderMobile: String(pickupAddress.phone).trim(),
        senderProvince: pickupAddress.province,
        senderCity: pickupAddress.city,
        senderDistrict: pickupAddress.district,
        senderAddress: pickupAddress.detail.trim(),
        expectTime: `${this.data.pickupDate} ${this.data.pickupTime}:00`,
        weight,
        cargoName: this.data.cargoName || '宠物医疗用品',
        remark: this.data.sfRemark || '',
      })
      wx.hideLoading()
      wx.showToast({ title: '已预约顺丰揽收', icon: 'success' })
      this.setData({ showSfPickupPanel: false })
      this.loadOrder(this.data.order.id)
    } catch (e: any) {
      wx.hideLoading()
      wx.showToast({ title: e?.message || '预约失败', icon: 'none' })
    }
  },

  async onSubmitDirectDelivery() {
    if (!this.data.etaDate || !this.data.etaTime) {
      wx.showToast({ title: '请选择预计到达时间', icon: 'none' })
      return
    }
    wx.showLoading({ title: '提交中...' })
    try {
      await clerkShipOrder({
        orderId: this.data.order.id,
        deliveryMode: 'direct',
        estimatedArrivalAt: `${this.data.etaDate} ${this.data.etaTime}`,
      })
      wx.hideLoading()
      wx.showToast({ title: '已记录出发', icon: 'success' })
      this.setData({ showDirectPanel: false })
      this.loadOrder(this.data.order.id)
    } catch (e: any) {
      wx.hideLoading()
      wx.showToast({ title: e?.message || '提交失败', icon: 'none' })
    }
  },

  async onSubmitExpress() {
    if (!this.data.selectedCompany || !this.data.expressNo) {
      wx.showToast({ title: '请选择快递公司并填写单号', icon: 'none' })
      return
    }
    if (!this.data.packageType || !this.data.coldChainMethod || !this.data.boxTemperature) {
      wx.showToast({ title: '请补全冷链发货信息', icon: 'none' })
      return
    }
    wx.showLoading({ title: '提交中...' })
    try {
      await clerkShipOrder({
        orderId: this.data.order.id,
        expressCompany: this.data.selectedCompany,
        expressNo: this.data.expressNo,
        packageType: this.data.packageType,
        coldChainMethod: this.data.coldChainMethod,
        packageWeight: this.data.packageWeight,
        boxTemperature: this.data.boxTemperature,
      })
      wx.hideLoading()
      const order = this.data.order
      const shipInfo = encodeURIComponent(JSON.stringify({
        orderId: order.id,
        orderNo: order.orderNo || order.id,
        expressCompany: this.data.selectedCompany,
        expressNo: this.data.expressNo,
        packageType: this.data.packageType,
        coldChainMethod: this.data.coldChainMethod,
        packageWeight: this.data.packageWeight,
        boxTemperature: this.data.boxTemperature,
      }))
      wx.redirectTo({ url: `/pages/clerk/ship-success/ship-success?shipInfo=${shipInfo}` })
    } catch (e: any) {
      wx.hideLoading()
      wx.showToast({ title: e?.message || '提交失败', icon: 'none' })
    }
  },

  onClosePanel() {
    this.setData({
      showExpressPanel: false,
      showDirectPanel: false,
      showSfPickupPanel: false,
      selectedCompany: '',
      expressNo: '',
      packageType: '冷藏箱',
      coldChainMethod: '冰袋（2-6°C）',
      packageWeight: '',
      boxTemperature: '',
    })
  },
})

export {}
