const { saveAddress, deleteAddress } = require('../../../services/index')

Page({
  data: {
    showForm: false,
    editingId: '',
    form: {
      name: '',
      phone: '',
      region: '',
      detail: '',
      hospitalName: '',
      isDefault: true,
    } as any,
    addresses: [] as any[],
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
    this.setData({ addresses: user.addresses || [] })
  },

  syncUser(user: any) {
    if (!user) return
    getApp().globalData.userInfo = user
    getApp().globalData.userRole = getApp().resolveRole?.(user) || getApp().globalData.userRole
    wx.setStorageSync('current_user', JSON.stringify(user))
    this.setData({ addresses: user.addresses || [] })
  },

  async onSetDefault(e: any) {
    const id = e.currentTarget.dataset.id
    const item = this.data.addresses.find((a: any) => a.id === id)
    const user = getApp().globalData.userInfo
    if (!item || !user) return
    wx.showLoading({ title: '保存中...' })
    try {
      const updated = await saveAddress(user.id, { ...item, isDefault: true })
      if (updated) {
        this.syncUser(updated)
        wx.showToast({ title: '已设为默认', icon: 'success' })
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    } catch (err: any) {
      wx.showToast({ title: err?.message || '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onEdit(e: any) {
    const id = e.currentTarget.dataset.id
    const item = this.data.addresses.find((a: any) => a.id === id)
    if (!item) return
    this.setData({
      showForm: true,
      editingId: id,
      form: {
        name: item.name,
        phone: item.phone,
        region: `${item.province}${item.city}${item.district}`,
        detail: item.detail,
        hospitalName: item.hospitalName || '',
        isDefault: item.isDefault,
      },
    })
  },

  onDelete(e: any) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个地址吗？',
      success: async (res) => {
        if (res.confirm) {
          const user = getApp().globalData.userInfo
          if (!user) return
          wx.showLoading({ title: '删除中...' })
          try {
            const updated = await deleteAddress(user.id, id)
            if (updated) {
              this.syncUser(updated)
              wx.showToast({ title: '已删除', icon: 'success' })
            } else {
              wx.showToast({ title: '删除失败', icon: 'none' })
            }
          } catch (err: any) {
            wx.showToast({ title: err?.message || '删除失败', icon: 'none' })
          } finally {
            wx.hideLoading()
          }
        }
      },
    })
  },

  onAddAddress() {
    this.setData({
      showForm: true,
      editingId: '',
      form: {
        name: '',
        phone: '',
        region: '',
        detail: '',
        hospitalName: '',
        isDefault: this.data.addresses.length === 0,
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

  onDefaultChange(e: any) {
    this.setData({ 'form.isDefault': e.detail.value })
  },

  async onSaveAddress() {
    const form = this.data.form
    if (!form.name || !form.phone || !form.region || !form.detail) {
      wx.showToast({ title: '请补全地址信息', icon: 'none' })
      return
    }
    const user = getApp().globalData.userInfo
    if (!user) return

    const next = {
      id: this.data.editingId,
      name: form.name,
      phone: form.phone,
      province: form.region,
      city: '',
      district: '',
      detail: form.detail,
      hospitalName: form.hospitalName,
      isDefault: form.isDefault,
    }
    wx.showLoading({ title: '保存中...' })
    try {
      const updated = await saveAddress(user.id, next)
      if (updated) {
        this.syncUser(updated)
        this.setData({ showForm: false, editingId: '' })
        wx.showToast({ title: '已保存', icon: 'success' })
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    } catch (err: any) {
      wx.showToast({ title: err?.message || '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },
})

export {}
