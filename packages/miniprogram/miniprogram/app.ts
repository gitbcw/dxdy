const tracking = require('./services/tracking')

const ROLE_HOME_PATHS: Record<string, string> = {
  customer_personal: '/pages/home/home',
  customer_institution: '/pages/home/home',
  salesperson: '/pages/home/home',
  clerk: '/pages/home/home',
  admin: '/pages/home/home',
}

function normalizePath(path = '') {
  return path.startsWith('/') ? path : `/${path}`
}

function getCurrentPath() {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1]
  return current?.route ? normalizePath(current.route) : ''
}

App<IAppOption>({
  globalData: {
    userInfo: null,
    token: '',
    userRole: '',
    catalogSearchKeyword: '',
    openid: '',
    authResolved: false,
    cartVersion: Number(wx.getStorageSync('cart_version') || 0),
  },

  onLaunch() {
    if (!wx.cloud) return
    wx.cloud.init({ env: 'cloud1-d7g7ctn4m86bada89', traceUser: true })
    tracking.init()
    this.restoreCachedUser?.()

    wx.cloud.callFunction({ name: 'getOpenId' }).then((res: any) => {
      const openid = res.result?.openid
      if (!openid) {
        this.globalData.authResolved = true
        return
      }

      this.globalData.openid = openid
      if (this.globalData.userInfo) {
        this.globalData.authResolved = true
        return
      }
      this.ensureOpenidUser?.()
    }).catch(() => {
      this.globalData.authResolved = true
    })
  },

  onHide() {
    tracking.pause()
  },

  onShow() {
    tracking.resume()
  },

  restoreCachedUser() {
    const userStr = wx.getStorageSync('current_user') as string
    if (!userStr) return

    try {
      this.globalData.userInfo = JSON.parse(userStr)
      this.globalData.userRole = this.resolveRole?.(this.globalData.userInfo) || ''
      tracking.setUserId(this.globalData.userInfo?.id || this.globalData.userInfo?._id || '')
    } catch {
      wx.removeStorageSync('current_user')
      wx.removeStorageSync('user_role')
    }
  },

  getRoleHomePath(role?: string) {
    return ROLE_HOME_PATHS[role || this.globalData.userRole || ''] || '/pages/home/home'
  },

  goRoleHome() {
    const url = this.getRoleHomePath?.() || '/pages/home/home'
    wx.switchTab({ url })
  },

  async ensureOpenidUser(options?: { referralCode?: string }) {
    const openid = this.globalData.openid
    if (!openid) return null

    const { ensureOpenidUser } = require('./services/index')
    const result = await ensureOpenidUser(options)
    if (result?.success && result.user) {
      this.globalData.userInfo = result.user
      this.globalData.userRole = this.resolveRole?.(result.user) || ''
      this.globalData.authResolved = true
      tracking.setUserId(result.user.id || result.user._id || '')
      wx.setStorageSync('current_user', JSON.stringify(result.user))
      wx.setStorageSync('user_role', this.globalData.userRole)
      return result.user
    }
    this.globalData.authResolved = true
    return null
  },

  resolveRole(user: any): string {
    if (!user) return ''
    if (user.role === 'customer') {
      return user.customerType === 'institution' ? 'customer_institution' : 'customer_personal'
    }
    return user.role
  },
})

export {}
