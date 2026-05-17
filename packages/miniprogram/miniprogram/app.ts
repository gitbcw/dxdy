const tracking = require('./services/tracking')

const LOGIN_PATH = '/pages/login/login'
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
        this.ensureLogin?.()
        return
      }

      this.globalData.openid = openid
      this.globalData.authResolved = true
      this.ensureLogin?.()
    }).catch(() => {
      this.globalData.authResolved = true
      this.ensureLogin?.()
    })
  },

  onHide() {
    tracking.pause()
  },

  onShow() {
    tracking.resume()
    this.ensureLogin?.()
  },

  restoreCachedUser() {
    const userStr = wx.getStorageSync('current_user') as string
    if (!userStr) return

    try {
      this.globalData.userInfo = JSON.parse(userStr)
      this.globalData.userRole = this.resolveRole?.(this.globalData.userInfo) || ''
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

  ensureLogin() {
    const currentPath = getCurrentPath()
    if (!currentPath) return

    const user = this.globalData.userInfo
    const isLoginPage = currentPath === LOGIN_PATH
    if (!user && !isLoginPage) {
      wx.reLaunch({ url: LOGIN_PATH })
      return
    }

    if (user && isLoginPage) {
      this.goRoleHome?.()
    }
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
