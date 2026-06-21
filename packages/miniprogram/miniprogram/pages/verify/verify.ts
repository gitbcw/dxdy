const { submitVerification } = require('../../services/index')
const icons = require('../../services/icons')

const SUBMIT_TIMEOUT_MS = 30000

Page({
  data: {
    status: 'none' as string,
    info: {} as any,
    licenseUrl: '',
    contactName: '',
    contactPhone: '',
    hospitalName: '',
    region: '',
    address: '',
    legalPerson: '',
    sitePhotoUrl: '',
    isPersonalCustomer: false,
    pendingIcon: icons.hospital,
    approvedIcon: icons.checkSuccess,
    submitting: false,
  },

  onLoad() {
    const app = getApp()
    const user = app.globalData.userInfo
    if (user?.role !== 'customer') {
      wx.showToast({ title: '仅门店客户可认证', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1000)
      return
    }
    this.setData({
      status: user.verificationStatus || 'none',
      info: user.verificationInfo || {},
      contactName: user.verificationInfo?.contactName || '',
      contactPhone: user.verificationInfo?.contactPhone || '',
      hospitalName: user.verificationInfo?.hospitalName || '',
      region: user.verificationInfo?.region || '',
      address: user.verificationInfo?.address || '',
      legalPerson: user.verificationInfo?.legalPerson || '',
      licenseUrl: user.verificationInfo?.businessLicense || '',
      sitePhotoUrl: user.verificationInfo?.sitePhoto || '',
      isPersonalCustomer: user.customerType !== 'institution',
    })
  },

  chooseLicense(e?: any) {
    const field = e?.currentTarget?.dataset?.field || 'licenseUrl'
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res: any) => {
        this.setData({ [field]: res.tempFiles[0].tempFilePath })
      },
    })
  },

  onFieldInput(e: any) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  onNameInput(e: any) {
    this.setData({ contactName: e.detail.value })
  },

  onPhoneInput(e: any) {
    this.setData({ contactPhone: e.detail.value })
  },

  async onSubmit() {
    if (this.data.submitting) return

    const { contactName, contactPhone, licenseUrl, hospitalName, legalPerson, region, address } = this.data
    if (!licenseUrl) {
      wx.showToast({ title: '请上传营业执照', icon: 'none' })
      return
    }
    if (!hospitalName.trim()) {
      wx.showToast({ title: '请输入门店名称', icon: 'none' })
      return
    }
    if (!contactName.trim()) {
      wx.showToast({ title: '请输入联系人姓名', icon: 'none' })
      return
    }
    if (!contactPhone || contactPhone.length < 11) {
      wx.showToast({ title: '请输入正确联系电话', icon: 'none' })
      return
    }

    const app = getApp()
    const user = app.globalData.userInfo
    if (!user?.id) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...', mask: true })
    try {
      const result = await Promise.race([
        submitVerification(user.id, {
          businessLicense: licenseUrl,
          sitePhoto: this.data.sitePhotoUrl,
          hospitalName: hospitalName.trim(),
          legalPerson: legalPerson.trim(),
          contactName: contactName.trim(),
          contactPhone,
          region,
          address,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('提交超时，请检查网络后重试')), SUBMIT_TIMEOUT_MS)),
      ]) as any

      if (result) {
        app.globalData.userInfo = result
        app.globalData.userRole = app.resolveRole?.(result) || app.globalData.userRole
        wx.setStorageSync('current_user', JSON.stringify(result))
        wx.setStorageSync('user_role', app.globalData.userRole)
        this.setData({
          status: 'pending',
          info: result.verificationInfo || {},
          isPersonalCustomer: false,
        })
        wx.showToast({ title: '提交成功', icon: 'success' })
      } else {
        wx.showToast({ title: '提交失败，请重试', icon: 'none' })
      }
    } catch (error: any) {
      const message = error?.message || '提交失败，请重试'
      wx.showToast({ title: message.length > 18 ? '提交失败，请重试' : message, icon: 'none' })
      console.error('[verify] submit failed', error)
    } finally {
      wx.hideLoading()
      this.setData({ submitting: false })
    }
  },

  goBack() {
    wx.navigateBack()
  },
})

export {}
