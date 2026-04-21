const { submitVerification } = require('../../services/index')

Page({
  data: {
    status: 'none' as string,
    info: {} as any,
    licenseUrl: '',
    contactName: '',
    contactPhone: '',
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
      licenseUrl: user.verificationInfo?.businessLicense || '',
      isPersonalCustomer: user.customerType !== 'institution',
    })
  },

  chooseLicense() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res: any) => {
        this.setData({ licenseUrl: res.tempFiles[0].tempFilePath })
      },
    })
  },

  onNameInput(e: any) {
    this.setData({ contactName: e.detail.value })
  },

  onPhoneInput(e: any) {
    this.setData({ contactPhone: e.detail.value })
  },

  async onSubmit() {
    const { contactName, contactPhone, licenseUrl } = this.data
    if (!licenseUrl) {
      wx.showToast({ title: '请上传营业执照', icon: 'none' })
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
      contactName: contactName.trim(),
      contactPhone,
    })
    wx.hideLoading()

    if (result) {
      app.globalData.userInfo = result
      app.globalData.userRole = result.customerType === 'institution' ? 'customer_institution' : 'customer_personal'
      wx.setStorageSync('current_user', JSON.stringify(result))
      wx.setStorageSync('demo_role', app.globalData.userRole)
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
