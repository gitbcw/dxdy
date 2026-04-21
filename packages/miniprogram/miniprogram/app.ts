const { loginByPhone } = require('./services/index')

App<IAppOption>({
  globalData: {
    userInfo: null,
    token: '',
    userRole: 'customer_personal',
    catalogSearchKeyword: '',
  },
  onLaunch() {
    // 从本地存储恢复登录状态
    const userStr = wx.getStorageSync('current_user') as string
    const storedRole = wx.getStorageSync('demo_role') as string
    if (storedRole) {
      this.globalData.userRole = storedRole
    }
    if (userStr) {
      try {
        this.globalData.userInfo = JSON.parse(userStr)
      } catch { /* ignore */ }
    } else {
      this.switchDemoRole?.('customer_personal')
    }
  },

  async switchDemoRole(role: string) {
    const phoneMap: Record<string, string> = {
      customer_institution: '13821003456',
      customer_personal: '13888002233',
      salesperson: '13811001234',
      clerk: '13833007890',
    }
    this.globalData.userRole = role
    wx.setStorageSync('demo_role', role)
    const phone = phoneMap[role] || phoneMap.customer_institution
    const result = await loginByPhone(phone)
    if (result.success && result.user) {
      this.globalData.userInfo = result.user
      wx.setStorageSync('current_user', JSON.stringify(result.user))
    }
  },
})

export {}
