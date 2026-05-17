const tracking = require('./services/tracking')

App<IAppOption>({
  globalData: {
    userInfo: null,
    token: '',
    userRole: '',
    catalogSearchKeyword: '',
    openid: '',
  },

  onLaunch() {
    if (!wx.cloud) return
    wx.cloud.init({ env: 'cloud1-d7g7ctn4m86bada89', traceUser: true })
    tracking.init()

    // 获取 openid
    wx.cloud.callFunction({ name: 'getOpenId' }).then((res: any) => {
      const openid = res.result?.openid
      if (openid) {
        this.globalData.openid = openid
        this.loadUserByOpenId?.(openid)
      }
    }).catch(() => {})

    // 优先从本地缓存恢复
    const userStr = wx.getStorageSync('current_user') as string
    if (userStr) {
      try {
        this.globalData.userInfo = JSON.parse(userStr)
        this.globalData.userRole = this.resolveRole?.(this.globalData.userInfo) || ''
      } catch { /* ignore */ }
    }
  },

  onHide() {
    tracking.pause()
  },

  onShow() {
    tracking.resume()
  },

  /** 根据 openid 从云数据库查找用户 */
  async loadUserByOpenId(openid: string) {
    try {
      const db = wx.cloud.database()
      const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
      if (data.length > 0) {
        const user = { ...data[0], id: data[0]._id }
        this.globalData.userInfo = user
        this.globalData.userRole = this.resolveRole?.(user) || ''
        wx.setStorageSync('current_user', JSON.stringify(user))
      }
    } catch { /* ignore */ }
  },

  /** 从用户对象推导角色标识（页面用） */
  resolveRole(user: any): string {
    if (!user) return ''
    if (user.role === 'customer') {
      return user.customerType === 'institution' ? 'customer_institution' : 'customer_personal'
    }
    return user.role // salesperson | clerk | admin
  },
})

export {}
