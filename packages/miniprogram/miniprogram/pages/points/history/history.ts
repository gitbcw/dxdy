const { checkPointsExpiry } = require('../../../services/index')

Page({
  data: {
    balance: 0,
    history: [] as any[],
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    const app = getApp()
    const user = app.globalData.userInfo
    if (!user) {
      this.setData({ balance: 0, history: [] })
      return
    }
    // 从数据库重新获取最新用户数据
    const db = wx.cloud.database()
    const { data } = await db.collection('users').doc(user.id || user._id).get()
    const checked = checkPointsExpiry(data)
    this.setData({
      balance: checked.balance,
      history: checked.history.slice().reverse().map((entry: any) => ({
        ...entry,
        amountText: entry.change > 0 ? `+${entry.change}` : `${entry.change}`,
        isPositive: entry.change > 0,
        dateText: (entry.createdAt || '').slice(0, 16),
      })),
    })
  },
})

export {}
