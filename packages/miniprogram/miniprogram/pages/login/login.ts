const { loginByPhone, bindCustomerPhone, GENERATED_ASSETS } = require('../../services/index')
const tracking = require('../../services/tracking')
const icons = require('../../services/icons')

function isDemoLoginEnabled() {
  return true
}

Page({
  data: {
    checkingSession: true,
    phone: '',
    loginHeroImage: GENERATED_ASSETS.loginHero,
    phoneIcon: icons.phone,
    shieldIcon: icons.shield,
    wechatIcon: icons.service,
    logoIcon: icons.hospital,
    referralCode: '',
    demoLoginEnabled: false,
    showDemoAccounts: false,
    demoAccounts: [
      { label: '普通客户', phone: '13888002233' },
      { label: '宠物医院', phone: '13821003456' },
      { label: '代理商', phone: '13811001234' },
      { label: '制单员', phone: '13833007890' },
    ],
  },

  onLoad(options: Record<string, string | undefined> = {}) {
    const demoLoginEnabled = isDemoLoginEnabled()
    this.setData({ demoLoginEnabled, checkingSession: false })

    const app = getApp()
    const cachedUser = app.globalData.userInfo
    if (cachedUser) {
      app.globalData.userRole = app.globalData.userRole || this.inferRole(cachedUser)
      this.setData({
        phone: cachedUser.phone || '',
      })
    }

    if (options.referralCode) {
      this.setData({ referralCode: options.referralCode })
      app.ensureOpenidUser?.({ referralCode: options.referralCode })
    }

    const demoPhone = options.demoPhone || ''
    if (!demoLoginEnabled || !/^1\d{10}$/.test(demoPhone)) return

    this.setData({ phone: demoPhone })

    if (options.autoLogin === '1' || options.autoLogin === 'true') {
      this.loginWithPhone(demoPhone, { redirectHome: true, silent: true, demo: true })
    }
  },

  onPhoneInput(e: any) {
    this.setData({ phone: e.detail.value })
  },

  toggleDemoAccounts() {
    if (!this.data.demoLoginEnabled) return
    this.setData({ showDemoAccounts: !this.data.showDemoAccounts })
  },

  useDemoAccount(e: any) {
    if (!this.data.demoLoginEnabled) return
    const phone = e.currentTarget.dataset.phone
    this.setData({ phone })
    this.loginWithPhone(phone, { redirectHome: true, demo: true })
  },

  inferRole(user: any) {
    if (user?.role === 'salesperson') return 'salesperson'
    if (user?.role === 'clerk') return 'clerk'
    if (user?.customerType === 'institution') return 'customer_institution'
    return 'customer_personal'
  },

  finishLogin(user: any, title: string, redirectHome = true) {
    const app = getApp()
    app.globalData.userInfo = user
    app.globalData.userRole = this.inferRole(user)
    app.globalData.authResolved = true
    tracking.setUserId(user.id || user._id || '')
    wx.setStorageSync('current_user', JSON.stringify(user))
    wx.setStorageSync('user_role', app.globalData.userRole)
    wx.showToast({ title, icon: 'success' })

    setTimeout(() => {
      if (redirectHome || getCurrentPages().length <= 1) {
        app.goRoleHome?.()
        return
      }
      wx.navigateBack()
    }, 500)
  },

  async loginWithPhone(phone: string, options: { redirectHome?: boolean, silent?: boolean, demo?: boolean } = {}) {
    if (!phone || phone.length !== 11) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' })
      return
    }

    if (!options.silent) wx.showLoading({ title: '进入中...' })
    const result = await loginByPhone(phone, { demo: options.demo === true })
    if (!options.silent) wx.hideLoading()

    if (result.success) {
      this.finishLogin(result.user, '进入成功', !!options.redirectHome)
    } else {
      wx.showToast({ title: result.error || '进入失败', icon: 'none' })
    }
  },

  async onSubmit() {
    const { phone } = this.data
    if (!phone || phone.length !== 11) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' })
      return
    }

    wx.showLoading({ title: '绑定中...' })
    const result = await bindCustomerPhone(phone)

    wx.hideLoading()

    if (result.success) {
      this.finishLogin(result.user, '绑定成功', false)
    } else {
      wx.showToast({ title: result.error || '操作失败', icon: 'none' })
    }
  },
})

export {}
