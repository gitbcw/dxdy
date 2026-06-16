const { loginByPhone, bindCustomerPhone, GENERATED_ASSETS, manageCardVoucher } = require('../../services/index')
const tracking = require('../../services/tracking')
const icons = require('../../services/icons')

Page({
  data: {
    checkingSession: true,
    phone: '',
    password: '',
    loginHeroImage: GENERATED_ASSETS.loginHero,
    loginBackgroundImage: GENERATED_ASSETS.loginFullscreen,
    brandLogo: '/assets/brand/dxiong-logo-transparent.png',
    phoneIcon: icons.phone,
    shieldIcon: icons.shield,
    wechatIcon: icons.service,
    logoIcon: icons.hospital,
    referralCode: '',
    redirect: '',
    bloodInvite: '',
  },

  onLoad(options: Record<string, string | undefined> = {}) {
    this.setData({ checkingSession: false })

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
      manageCardVoucher({ action: 'recordAgentPromoVisit', referralCode: options.referralCode }).catch(() => null)
    }

    if (options.redirect) {
      this.setData({ redirect: decodeURIComponent(options.redirect) })
    }
    if (options.bloodInvite) {
      this.setData({ bloodInvite: options.bloodInvite })
    }

  },

  onPhoneInput(e: any) {
    this.setData({ phone: e.detail.value })
  },

  onPasswordInput(e: any) {
    this.setData({ password: e.detail.value })
  },

  noop() {},

  inferRole(user: any) {
    if (user?.role === 'salesperson') return 'salesperson'
    if (user?.role === 'clerk') return 'clerk'
    if (user?.role === 'customer') return user.customerType === 'personal' ? 'customer_personal' : 'customer_institution'
    return user?.role || ''
  },

  onRegisterTap() {
    const params: string[] = []
    if (this.data.referralCode) params.push(`referralCode=${encodeURIComponent(this.data.referralCode)}`)
    if (this.data.redirect) params.push(`redirect=${encodeURIComponent(this.data.redirect)}`)
    if (this.data.bloodInvite) params.push(`bloodInvite=${encodeURIComponent(this.data.bloodInvite)}`)
    wx.navigateTo({ url: `/pages/register/register${params.length ? `?${params.join('&')}` : ''}` })
  },

  onForgotPasswordTap() {
    wx.navigateTo({ url: '/pages/login/forgot-password/forgot-password' })
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
      if (this.data.redirect) {
        wx.redirectTo({ url: this.data.redirect })
        return
      }
      if (redirectHome || getCurrentPages().length <= 1) {
        app.goRoleHome?.()
        return
      }
      wx.navigateBack()
    }, 500)
  },

  async loginWithPhone(phone: string, password: string, options: { redirectHome?: boolean, silent?: boolean } = {}) {
    if (!phone || phone.length !== 11) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' })
      return
    }
    if (!password || password.length < 6) {
      wx.showToast({ title: '请输入至少6位密码', icon: 'none' })
      return
    }

    if (!options.silent) wx.showLoading({ title: '登录中...' })
    const result = await loginByPhone(phone, { password })
    if (!options.silent) wx.hideLoading()

    if (result.success) {
      this.finishLogin(result.user, '登录成功', !!options.redirectHome)
    } else {
      wx.showToast({ title: result.error || '登录失败', icon: 'none' })
    }
  },

  async onSubmit() {
    const { phone, password } = this.data
    if (!phone || phone.length !== 11) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' })
      return
    }
    if (!password || password.length < 6) {
      wx.showToast({ title: '请输入至少6位密码', icon: 'none' })
      return
    }

    await this.loginWithPhone(phone, password, { redirectHome: true })
  },

  async onBindPhoneSubmit() {
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
