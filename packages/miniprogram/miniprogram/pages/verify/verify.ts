const { submitVerification } = require('../../services/index')

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
  },

  onLoad() {
    const app = getApp()
    const user = app.globalData.userInfo
    if (user?.role !== 'customer') {
      wx.showToast({ title: '仅机构客户可认证', icon: 'none' })
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
    const { contactName, contactPhone, licenseUrl, hospitalName, legalPerson, region, address } = this.data
    if (!licenseUrl) {
      wx.showToast({ title: '请上传营业执照', icon: 'none' })
      return
    }
    if (!hospitalName.trim()) {
      wx.showToast({ title: '请输入医院名称', icon: 'none' })
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

    wx.showLoading({ title: '提交中...' })
    const app = getApp()
    const user = app.globalData.userInfo
    const result = await submitVerification(user.id, {
      businessLicense: licenseUrl,
      sitePhoto: this.data.sitePhotoUrl,
      hospitalName: hospitalName.trim(),
      legalPerson: legalPerson.trim(),
      contactName: contactName.trim(),
      contactPhone,
      region,
      address,
    })
    wx.hideLoading()

    if (result) {
      app.globalData.userInfo = result
      app.globalData.userRole = app.resolveRole?.(result) || app.globalData.userRole
      wx.setStorageSync('current_user', JSON.stringify(result))
      wx.setStorageSync('user_role', app.globalData.userRole)
      wx.showToast({ title: '提交成功', icon: 'success' })
      this.setData({
        status: 'pending',
        info: result.verificationInfo || {},
        isPersonalCustomer: false,
      })
    } else {
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
    }
  },

  goBack() {
    wx.navigateBack()
  },
})

export {}
