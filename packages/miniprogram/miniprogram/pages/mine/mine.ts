const { logout: doLogout, formatMoney, getCustomerById } = require('../../services/index')

Page({
  data: {
    isLogin: false,
    userInfo: null as any,
    balance: '0.00',
    points: 0,
  },

  onShow() {
    const user = getApp().globalData.userInfo
    if (user) {
      this.setData({
        isLogin: true,
        userInfo: user,
        balance: formatMoney(user.wallet?.balance ?? 0),
        points: user.points?.balance ?? 0,
      })
    } else {
      this.setData({ isLogin: false, userInfo: null })
    }
  },

  onLoginTap() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  onLogout() {
    doLogout()
    getApp().globalData.userInfo = null
    wx.removeStorageSync('current_user')
    this.setData({ isLogin: false, userInfo: null })
  },

  onOrdersTap() {
    wx.navigateTo({ url: '/pages/orders/order-detail/order-detail?list=1' })
  },

  onAddressTap() {
    wx.showToast({ title: '地址管理开发中', icon: 'none' })
  },
})
