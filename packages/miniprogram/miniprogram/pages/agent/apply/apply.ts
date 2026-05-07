const { submitAgentApplication } = require('../../../services/index')
const icons = require('../../../services/icons')

Page({
  data: {
    companyName: '',
    realName: '',
    idNumber: '',
    contactName: '',
    contactPhone: '',
    region: '',
    address: '',
    businessArea: '',
    experience: '',
    channelType: 'clinic',
    expectedMonthlySales: '',
    remark: '',
    agreementAccepted: false,
    agreementIcon: icons.shield,
    channelOptions: [
      { key: 'clinic', label: '医院/诊所资源' },
      { key: 'distributor', label: '区域经销' },
      { key: 'online', label: '线上社群' },
    ],
  },

  onLoad() {
    const user = getApp().globalData.userInfo
    if (!user) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      setTimeout(() => wx.navigateTo({ url: '/pages/login/login' }), 500)
      return
    }
    const appInfo = user.agentApplication || {}
    this.setData({
      companyName: appInfo.companyName || '',
      realName: appInfo.realName || appInfo.contactName || user.nickname || '',
      idNumber: appInfo.idNumber || '',
      contactName: appInfo.contactName || user.nickname || '',
      contactPhone: appInfo.contactPhone || user.phone || '',
      region: appInfo.region || '',
      address: appInfo.address || '',
      businessArea: appInfo.businessArea || '',
      experience: appInfo.experience || '',
      channelType: appInfo.channelType || 'clinic',
      expectedMonthlySales: appInfo.expectedMonthlySales || '',
      remark: appInfo.remark || '',
    })
  },

  onFieldInput(e: any) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  onChannelTap(e: any) {
    this.setData({ channelType: e.currentTarget.dataset.key })
  },

  onAgreementTap() {
    this.setData({ agreementAccepted: !this.data.agreementAccepted })
  },

  async onSubmit() {
    const {
      companyName,
      realName,
      idNumber,
      contactName,
      contactPhone,
      region,
      address,
      businessArea,
      experience,
      channelType,
      expectedMonthlySales,
      remark,
      agreementAccepted,
    } = this.data

    if (!realName.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }
    if (!idNumber.trim()) {
      wx.showToast({ title: '请输入身份证号', icon: 'none' })
      return
    }
    if (!companyName.trim()) {
      wx.showToast({ title: '请输入公司或机构名称', icon: 'none' })
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
    if (!region.trim() || !businessArea.trim()) {
      wx.showToast({ title: '请填写代理区域和业务覆盖', icon: 'none' })
      return
    }
    if (!agreementAccepted) {
      wx.showToast({ title: '请先阅读并同意合作协议', icon: 'none' })
      return
    }

    wx.showLoading({ title: '提交中...' })
    const app = getApp()
    const user = app.globalData.userInfo
    const result = await submitAgentApplication(user.id, {
      companyName: companyName.trim(),
      realName: realName.trim(),
      idNumber: idNumber.trim(),
      contactName: contactName.trim(),
      contactPhone,
      region: region.trim(),
      address: address.trim(),
      businessArea: businessArea.trim(),
      experience: experience.trim(),
      channelType,
      expectedMonthlySales: expectedMonthlySales.trim(),
      remark: remark.trim(),
    })
    wx.hideLoading()

    if (!result) {
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
      return
    }

    app.globalData.userInfo = result
    wx.setStorageSync('current_user', JSON.stringify(result))
    wx.showToast({ title: '提交成功', icon: 'success' })
    setTimeout(() => {
      wx.redirectTo({ url: '/pages/agent/verify-status/verify-status' })
    }, 500)
  },
})

export {}
