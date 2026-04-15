// app.ts
App<IAppOption>({
  globalData: {
    userInfo: null,
    token: '',
  },
  onLaunch() {
    // 从本地存储恢复登录状态
    const userStr = wx.getStorageSync('current_user') as string
    if (userStr) {
      try {
        this.globalData.userInfo = JSON.parse(userStr)
      } catch { /* ignore */ }
    }
  },
})
