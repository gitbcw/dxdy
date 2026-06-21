const { createOrder, requireBoundPhone, getSystemConfig, getBloodBookingInvite } = require('../../../services/index')

type Species = 'dog' | 'cat'

const SELECTED_ADDRESS_KEY = 'selected_order_address_id'

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDefaultBookingDate() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return formatDate(date)
}

function getDefaultAddress(user: any) {
  const addresses = Array.isArray(user?.addresses) ? user.addresses : []
  const selectedId = wx.getStorageSync(SELECTED_ADDRESS_KEY) as string
  return addresses.find((item: any) => item.id === selectedId)
    || addresses.find((item: any) => item.isDefault)
    || addresses[0]
    || null
}

function formatAddressText(address: any) {
  if (!address) return '请选择收货地址'
  return `${address.province || ''}${address.city || ''}${address.district || ''}${address.detail || ''}`
}

const dogBloodTypes = [
  'DEA1.1阳性',
  'DEA1.1阴性',
  'DEA1.1阴性 + DEA7阴性（通用供血优先）',
  'DEA7阴性',
  '未检测，需协助配血',
]

const catBloodTypes = [
  'A型',
  'B型',
  'AB型',
  '未检测，需协助配血',
]

const defaultVolumes = {
  dog: [100, 200, 300, 400, 500],
  cat: [50, 100, 150, 200],
}

const speciesOptions = [
  { value: 'dog', label: '犬血', hint: '重点关注 DEA1.1、DEA7，二次输血必须交叉配血。' },
  { value: 'cat', label: '猫血', hint: '猫需严格同型优先，首次输血也必须交叉配血。' },
]

const hourOptions = Array.from({ length: 13 }, (_, index) => {
  const hour = String(index + 8).padStart(2, '0')
  return `${hour}:00`
})

Page({
  data: {
    isInstitution: false,
    isVerified: false,
    isPersonalInvite: false,
    inviteId: '',
    invite: null as any,
    inviteError: '',
    priceMode: 'store' as 'store' | 'retail',
    species: 'dog' as Species,
    speciesOptions,
    bloodTypes: dogBloodTypes,
    bloodTypeIndex: 0,
    volumeOptions: defaultVolumes.dog,
    volumeIndex: 0,
    volumeMl: defaultVolumes.dog[0],
    priceRules: [] as any[],
    bookingAmount: 0,
    bookingAmountText: '0.00',
    bookingDate: getDefaultBookingDate(),
    bookingHourIndex: 2,
    bookingHours: hourOptions,
    minBookingDate: formatDate(new Date()),
    selectedAddress: null as any,
    contactName: '',
    contactPhone: '',
    addressText: '请选择收货地址',
    isUrgent: false,
    remark: '',
    safetyTips: [] as string[],
    submitting: false,
  },

  onLoad(options: Record<string, string | undefined> = {}) {
    const scene = options.scene ? decodeURIComponent(options.scene) : ''
    const inviteId = options.invite || scene.replace(/^invite=/, '')
    this.setData({ inviteId })
  },

  onShow() {
    this.initForm()
  },

  async initForm() {
    const user = getApp().globalData.userInfo
    if (!user?.phone && this.data.inviteId) {
      wx.navigateTo({ url: `/pages/register/register?bloodInvite=${encodeURIComponent(this.data.inviteId)}` })
      return
    }
    if (!requireBoundPhone(user)) {
      return
    }

    const [config, invite] = await Promise.all([
      getSystemConfig(),
      this.data.inviteId ? getBloodBookingInvite(this.data.inviteId).catch((err: any) => ({ error: err?.message || '预约二维码无效' })) : Promise.resolve(null),
    ])

    const isInstitution = user?.customerType === 'institution'
    const isVerified = user?.verificationStatus === 'approved'
    const isPersonalInvite = user?.customerType === 'personal' && !!this.data.inviteId && !!invite && !invite.error
    const bloodBookingConfig = config?.bloodBookingConfig || {}
    const dogTypes = Array.isArray(bloodBookingConfig.dogBloodTypes) && bloodBookingConfig.dogBloodTypes.length ? bloodBookingConfig.dogBloodTypes : dogBloodTypes
    const catTypes = Array.isArray(bloodBookingConfig.catBloodTypes) && bloodBookingConfig.catBloodTypes.length ? bloodBookingConfig.catBloodTypes : catBloodTypes
    const dogVolumes = Array.isArray(bloodBookingConfig.dogVolumeOptions) && bloodBookingConfig.dogVolumeOptions.length ? bloodBookingConfig.dogVolumeOptions : defaultVolumes.dog
    const catVolumes = Array.isArray(bloodBookingConfig.catVolumeOptions) && bloodBookingConfig.catVolumeOptions.length ? bloodBookingConfig.catVolumeOptions : defaultVolumes.cat
    const bloodTypes = this.data.species === 'dog' ? dogTypes : catTypes
    const volumeOptions = this.data.species === 'dog' ? dogVolumes : catVolumes
    const address = getDefaultAddress(user)
    this.setData({
      isInstitution,
      isVerified,
      isPersonalInvite,
      invite: invite && !invite.error ? invite : null,
      inviteError: invite && invite.error ? invite.error : '',
      priceMode: isPersonalInvite ? 'retail' : 'store',
      bloodTypes,
      bloodTypeIndex: Math.min(this.data.bloodTypeIndex, Math.max(0, bloodTypes.length - 1)),
      volumeOptions,
      volumeIndex: Math.min(this.data.volumeIndex || 0, Math.max(0, volumeOptions.length - 1)),
      volumeMl: volumeOptions[Math.min(this.data.volumeIndex || 0, Math.max(0, volumeOptions.length - 1))] || '',
      priceRules: Array.isArray(bloodBookingConfig.priceRules) ? bloodBookingConfig.priceRules : [],
      selectedAddress: address,
      contactName: address?.name || user?.nickname || user?.realName || '',
      contactPhone: address?.phone || user?.phone || '',
      addressText: formatAddressText(address),
    })
    this.updateSafetyTips()
    this.updateBookingAmount()
  },

  updateSafetyTips() {
    const species = this.data.species
    const bloodType = this.data.bloodTypes[this.data.bloodTypeIndex] || ''
    const tips = species === 'dog'
      ? [
          '犬输血优先同型，DEA1.1阳性血禁止输给 DEA1.1阴性犬。',
          'DEA1.1阴性 + DEA7阴性可作为急诊通用供血优先选择。',
          bloodType.includes('未检测') ? '未检测血型时，请先完成血型鉴定和交叉配血。' : '二次输血、孕犬或长期贫血患犬必须做交叉配血。',
        ]
      : [
          '猫异型输血风险极高，A/B/AB 血型必须先明确。',
          'B型猫仅可接受B型血，禁止输入A型或AB型血。',
          bloodType.includes('未检测') ? '未检测血型时，不建议经验性输血，请先做快速血型检测。' : '猫首次输血也必须做交叉配血。',
        ]
    this.setData({ safetyTips: tips })
  },

  onSpeciesTap(e: any) {
    const species = e.currentTarget.dataset.value as Species
    const bloodTypes = species === 'dog' ? this.data.bloodTypes.filter((item: string) => dogBloodTypes.includes(item)) : catBloodTypes
    const priceRules = this.data.priceRules || []
    const configuredTypes = Array.from(new Set(priceRules.filter((rule: any) => rule.species === species).map((rule: any) => rule.bloodType).filter(Boolean))) as string[]
    const nextBloodTypes = configuredTypes.length ? configuredTypes : (species === 'dog' ? dogBloodTypes : catBloodTypes)
    const volumeOptions = species === 'dog'
      ? (priceRules.filter((rule: any) => rule.species === 'dog').map((rule: any) => Number(rule.volumeMl)).filter(Boolean) || defaultVolumes.dog)
      : (priceRules.filter((rule: any) => rule.species === 'cat').map((rule: any) => Number(rule.volumeMl)).filter(Boolean) || defaultVolumes.cat)
    const uniqueVolumes = Array.from(new Set(volumeOptions)).sort((a, b) => a - b)
    this.setData({
      species,
      bloodTypes: nextBloodTypes,
      bloodTypeIndex: 0,
      volumeOptions: uniqueVolumes.length ? uniqueVolumes : defaultVolumes[species],
      volumeIndex: 0,
      volumeMl: (uniqueVolumes.length ? uniqueVolumes : defaultVolumes[species])[0],
    })
    this.updateSafetyTips()
    this.updateBookingAmount()
  },

  onBloodTypeChange(e: any) {
    this.setData({ bloodTypeIndex: Number(e.detail.value) })
    this.updateSafetyTips()
    this.updateBookingAmount()
  },

  onVolumeChange(e: any) {
    const volumeIndex = Number(e.detail.value)
    this.setData({
      volumeIndex,
      volumeMl: this.data.volumeOptions[volumeIndex] || 0,
    })
    this.updateBookingAmount()
  },

  getCurrentPriceRule() {
    const bloodType = this.data.bloodTypes[this.data.bloodTypeIndex] || ''
    const volumeMl = Number(this.data.volumeMl || 0)
    return (this.data.priceRules || []).find((rule: any) => (
      rule.species === this.data.species &&
      String(rule.bloodType || '') === bloodType &&
      Number(rule.volumeMl) === volumeMl
    ))
  },

  updateBookingAmount() {
    const rule = this.getCurrentPriceRule()
    const legacyPrice = Number(rule?.price || 0)
    const storePrice = Number(rule?.storePrice || legacyPrice || 0)
    const retailPrice = Number(rule?.retailPrice || (storePrice > 0 ? storePrice * 2 : 0))
    const amount = this.data.priceMode === 'retail' ? retailPrice : storePrice
    this.setData({
      bookingAmount: amount,
      bookingAmountText: Number(amount || 0).toFixed(2),
    })
  },

  onDateChange(e: any) {
    this.setData({ bookingDate: e.detail.value })
  },

  onHourChange(e: any) {
    this.setData({ bookingHourIndex: Number(e.detail.value) })
  },

  onInput(e: any) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  onUrgentToggle() {
    this.setData({ isUrgent: !this.data.isUrgent })
  },

  onRemarkTap() {
    wx.showModal({
      title: '预约备注',
      editable: true,
      placeholderText: '可填写受血动物情况、期望配送时间等',
      content: this.data.remark,
      success: (res: any) => {
        if (!res.confirm) return
        this.setData({ remark: String(res.content || '').trim() })
      },
    })
  },

  onGoVerify() {
    wx.navigateTo({ url: '/pages/verify/verify' })
  },

  onShareConsumerTap() {
    wx.navigateTo({ url: '/pages/blood/invite/invite' })
  },

  onAddressTap() {
    wx.navigateTo({ url: '/pages/mine/address/address?select=1' })
  },

  validateForm() {
    if (!this.data.isInstitution && !this.data.isPersonalInvite) return '请通过医院提供的预约二维码进入'
    if (this.data.isInstitution && !this.data.isVerified) return '请先完成门店认证'
    if (this.data.inviteId && this.data.inviteError) return this.data.inviteError
    const volume = Number(this.data.volumeMl)
    if (!Number.isFinite(volume) || volume <= 0) return '请输入需要的血量'
    if (!this.data.bookingAmount || this.data.bookingAmount <= 0) return '当前血型和血量暂未配置价格'
    if (volume > 5000) return '单次预约血量请勿超过5000ml'
    if (!this.data.bookingDate) return '请选择预约日期'
    if (!this.data.selectedAddress) return '请选择收货地址'
    return ''
  },

  async onSubmit() {
    const user = getApp().globalData.userInfo
    const message = this.validateForm()
    if (message) {
      wx.showToast({ title: message, icon: 'none' })
      return
    }
    if (this.data.submitting) return

    const speciesLabel = this.data.species === 'dog' ? '犬血' : '猫血'
    const bloodType = this.data.bloodTypes[this.data.bloodTypeIndex]
    const volumeMl = Number(this.data.volumeMl)
    const selectedAddress = this.data.selectedAddress
    const addressText = formatAddressText(selectedAddress)
    const bookingTime = `${this.data.bookingDate} ${this.data.bookingHours[this.data.bookingHourIndex]}`
    const booking = {
      bloodBooking: true,
      species: this.data.species,
      speciesLabel,
      bloodType,
      volumeMl,
      date: bookingTime,
      location: addressText,
      contactName: selectedAddress.name,
      contactPhone: selectedAddress.phone,
      address: addressText,
      urgent: this.data.isUrgent,
      inviteId: this.data.inviteId,
      hospitalReferrerId: this.data.invite?.hospitalId || '',
      hospitalReferrerName: this.data.invite?.hospitalName || '',
      priceMode: this.data.priceMode,
    }

    try {
      this.setData({ submitting: true })
      wx.showLoading({ title: '提交中...' })
      const order = await createOrder({
        customerId: user.id,
        type: 'booking',
        items: [{
          productId: `blood_booking_${this.data.species}`,
          productName: `${speciesLabel}用血预约`,
          productType: 'blood_booking',
          bookingRequest: true,
          species: this.data.species,
          bloodType,
          volumeMl,
          spec: `${bloodType} · ${volumeMl}ml`,
          quantity: 1,
          unitPrice: 0,
          totalPrice: 0,
        }],
        booking,
        isUrgent: this.data.isUrgent,
        shippingAddress: {
          name: booking.contactName,
          phone: booking.contactPhone,
          full: booking.address,
        },
        remark: this.data.remark.trim(),
      })
      wx.hideLoading()
      wx.showToast({ title: '预约已提交', icon: 'success' })
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/orders/order-detail/order-detail?id=${order.id}` })
      }, 700)
    } catch (err: any) {
      wx.hideLoading()
      wx.showToast({ title: err?.message || '提交失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },
})

export {}
