const { loginByPhone, registerCustomer } = require('../../services/index')

Page({
  data: {
    phone: '',
    isRegister: false,
    nickname: '',
    demoAccounts: [
      { label: '普通客户', phone: '13888002233' },
      { label: '未认证机构', phone: '13822003456' },
      { label: '宠物医院', phone: '13821003456' },
      { label: '个人客户', phone: '13877005678' },
      { label: '业务员', phone: '13811001234' },
      { label: '制单员', phone: '13833007890' },
    ],
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

  useDemoAccount(e: any) {
    this.setData({ phone: e.currentTarget.dataset.phone, isRegister: false })
  },

  inferRole(user: any) {
    if (user?.role === 'salesperson') return 'salesperson'
    if (user?.role === 'clerk') return 'clerk'
    if (user?.customerType === 'institution') return 'customer_institution'
    return 'customer_personal'
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
      const app = getApp()
      app.globalData.userInfo = result.user
      app.globalData.userRole = this.inferRole(result.user)
      wx.setStorageSync('current_user', JSON.stringify(result.user))
      wx.setStorageSync('demo_role', app.globalData.userRole)
      wx.showToast({ title: isRegister ? '注册成功' : '登录成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 500)
    } else {
      wx.showToast({ title: result.error || '操作失败', icon: 'none' })
    }
  },
})

export {}
