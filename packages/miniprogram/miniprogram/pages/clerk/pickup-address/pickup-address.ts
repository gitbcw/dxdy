const { savePickupAddress, deletePickupAddress } = require('../../../services/index')

const SELECTED_PICKUP_ADDRESS_KEY = 'selected_pickup_address_id'

Page({
  data: {
    showForm: false,
    editingId: '',
    selectMode: false,
    addresses: [] as any[],
    form: {
      name: '',
      phone: '',
      region: '',
      regionArray: [] as string[],
      detail: '',
      label: '',
      isDefault: true,
    } as any,
  },

  onLoad(options: any = {}) {
    this.setData({ selectMode: options.select === '1' || options.mode === 'select' })
  },

  onShow() {
    this.loadAddresses()
  },

  loadAddresses() {
    const user = getApp().globalData.userInfo
    if (!user) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    this.setData({ addresses: user.pickupAddresses || [] })
  },

  syncUser(user: any) {
    if (!user) return
    getApp().globalData.userInfo = user
    getApp().globalData.userRole = getApp().resolveRole?.(user) || getApp().globalData.userRole
    wx.setStorageSync('current_user', JSON.stringify(user))
    this.setData({ addresses: user.pickupAddresses || [] })
  },

  onAddAddress() {
    this.setData({
      showForm: true,
      editingId: '',
      form: {
        name: '',
        phone: '',
        region: '',
        regionArray: [],
        detail: '',
        label: '',
        isDefault: this.data.addresses.length === 0,
      },
    })
  },

  onEdit(e: any) {
    const id = e.currentTarget.dataset.id
    const item = this.data.addresses.find((address: any) => address.id === id)
    if (!item) return
    const regionArray = item.city || item.district ? [item.province || '', item.city || '', item.district || ''] : []
    this.setData({
      showForm: true,
      editingId: id,
      form: {
        name: item.name || '',
        phone: item.phone || '',
        region: regionArray.length ? regionArray.join('') : `${item.province || ''}${item.city || ''}${item.district || ''}`,
        regionArray,
        detail: item.detail || '',
        label: item.label || '',
        isDefault: !!item.isDefault,
      },
    })
  },

  onCancelForm() {
    this.setData({ showForm: false, editingId: '' })
  },

  onFormInput(e: any) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  onRegionChange(e: any) {
    const regionArray = e.detail.value || []
    this.setData({
      'form.regionArray': regionArray,
      'form.region': regionArray.join(''),
    })
  },

  onDefaultChange(e: any) {
    this.setData({ 'form.isDefault': e.detail.value })
  },

  async onSetDefault(e: any) {
    const id = e.currentTarget.dataset.id
    const item = this.data.addresses.find((address: any) => address.id === id)
    const user = getApp().globalData.userInfo
    if (!item || !user) return
    wx.showLoading({ title: '保存中...' })
    try {
      const updated = await savePickupAddress(user.id, { ...item, isDefault: true })
      this.syncUser(updated)
      wx.showToast({ title: '已设为默认', icon: 'success' })
    } catch (err: any) {
      wx.showToast({ title: err?.message || '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onDelete(e: any) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个揽收地址吗？',
      success: async (res) => {
        if (!res.confirm) return
        const user = getApp().globalData.userInfo
        if (!user) return
        wx.showLoading({ title: '删除中...' })
        try {
          const updated = await deletePickupAddress(user.id, id)
          this.syncUser(updated)
          wx.showToast({ title: '已删除', icon: 'success' })
        } catch (err: any) {
          wx.showToast({ title: err?.message || '删除失败', icon: 'none' })
        } finally {
          wx.hideLoading()
        }
      },
    })
  },

  onSelectAddress(e: any) {
    if (!this.data.selectMode) return
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.setStorageSync(SELECTED_PICKUP_ADDRESS_KEY, id)
    wx.navigateBack()
  },

  async onSaveAddress() {
    const form = this.data.form
    if (!form.name || !form.phone || !form.regionArray?.length || !form.detail) {
      wx.showToast({ title: '请补全揽收地址信息', icon: 'none' })
      return
    }
    if (!/^1\d{10}$/.test(String(form.phone).trim())) {
      wx.showToast({ title: '请填写有效手机号', icon: 'none' })
      return
    }
    const user = getApp().globalData.userInfo
    if (!user) return
    const next = {
      id: this.data.editingId,
      name: form.name.trim(),
      phone: String(form.phone).trim(),
      province: form.regionArray[0] || '',
      city: form.regionArray[1] || '',
      district: form.regionArray[2] || '',
      detail: form.detail.trim(),
      label: form.label.trim(),
      isDefault: !!form.isDefault,
    }
    wx.showLoading({ title: '保存中...' })
    try {
      const updated = await savePickupAddress(user.id, next)
      this.syncUser(updated)
      if (this.data.selectMode) {
        const selected = (updated.pickupAddresses || []).find((item: any) => {
          if (next.id) return item.id === next.id
          return item.name === next.name && item.phone === next.phone && item.detail === next.detail
        })
        if (selected?.id) wx.setStorageSync(SELECTED_PICKUP_ADDRESS_KEY, selected.id)
      }
      this.setData({ showForm: false, editingId: '' })
      wx.showToast({ title: '已保存', icon: 'success' })
      if (this.data.selectMode) setTimeout(() => wx.navigateBack(), 500)
    } catch (err: any) {
      wx.showToast({ title: err?.message || '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },
})

export {}
