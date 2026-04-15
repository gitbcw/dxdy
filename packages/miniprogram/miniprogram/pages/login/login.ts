const { loginByPhone, registerCustomer } = require('../../services/index')

Page({
  data: {
    phone: '',
    isRegister: false,
    nickname: '',
  },

  onPhoneInput(e: any) {
    this.setData({ phone: e.detail.value })
  },

  onNicknameInput(e: any) {
    this.setData({ nickname: e.detail.value })
  },

  toggleMode() {
    this.setData({ isRegister: !this.data.isRegister })
  },

  async onSubmit() {
    const { phone, isRegister, nickname } = this.data
    if (!phone || phone.length !== 11) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' })
      return
    }

    wx.showLoading({ title: isRegister ? '注册中...' : '登录中...' })

    let result: any
    if (isRegister) {
      if (!nickname) {
        wx.hideLoading()
        wx.showToast({ title: '请输入昵称', icon: 'none' })
        return
      }
      result = await registerCustomer(phone, nickname)
    } else {
      result = await loginByPhone(phone)
    }

    wx.hideLoading()

    if (result.success) {
      getApp().globalData.userInfo = result.user
      wx.setStorageSync('current_user', JSON.stringify(result.user))
      wx.showToast({ title: isRegister ? '注册成功' : '登录成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 500)
    } else {
      wx.showToast({ title: result.error || '操作失败', icon: 'none' })
    }
  },
})
