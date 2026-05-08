const { loginByPhone, registerCustomer, GENERATED_ASSETS } = require('../../services/index')
const icons = require('../../services/icons')

Page({
  data: {
    phone: '',
    isRegister: false,
    nickname: '',
    loginHeroImage: GENERATED_ASSETS.loginHero,
    phoneIcon: icons.phone,
    userIcon: icons.user,
    shieldIcon: icons.shield,
    wechatIcon: icons.service,
    logoIcon: icons.hospital,
    showDemoAccounts: false,
    demoAccounts: [
      { label: '普通客户', phone: '13888002233' },
      { label: '未认证机构', phone: '13822003456' },
      { label: '宠物医院', phone: '13821003456' },
      { label: '个人客户', phone: '13877005678' },
      { label: '业务员', phone: '13811001234' },
      { label: '制单员', phone: '13833007890' },
    ],
  },

  onLoad(options: Record<string, string | undefined> = {}) {
    const demoPhone = options.demoPhone || ''
    if (!/^1\d{10}$/.test(demoPhone)) return

    this.setData({ phone: demoPhone, isRegister: false })

    if (options.autoLogin === '1' || options.autoLogin === 'true') {
      this.loginWithPhone(demoPhone, { redirectHome: true, silent: true })
    }
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

  toggleDemoAccounts() {
    this.setData({ showDemoAccounts: !this.data.showDemoAccounts })
  },

  showLogin() {
    this.setData({ isRegister: false })
  },

  showRegister() {
    this.setData({ isRegister: true })
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

  finishLogin(user: any, title: string, redirectHome = false) {
    const app = getApp()
    app.globalData.userInfo = user
    app.globalData.userRole = this.inferRole(user)
    wx.setStorageSync('current_user', JSON.stringify(user))
    wx.setStorageSync('user_role', app.globalData.userRole)
    wx.showToast({ title, icon: 'success' })

    setTimeout(() => {
      if (redirectHome || getCurrentPages().length <= 1) {
        wx.switchTab({ url: '/pages/home/home' })
        return
      }
      wx.navigateBack()
    }, 500)
  },

  async loginWithPhone(phone: string, options: { redirectHome?: boolean, silent?: boolean } = {}) {
    if (!phone || phone.length !== 11) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' })
      return
    }

    if (!options.silent) wx.showLoading({ title: '登录中...' })
    const result = await loginByPhone(phone)
    if (!options.silent) wx.hideLoading()

    if (result.success) {
      this.finishLogin(result.user, '登录成功', !!options.redirectHome)
    } else {
      wx.showToast({ title: result.error || '登录失败', icon: 'none' })
    }
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
      this.finishLogin(result.user, isRegister ? '注册成功' : '登录成功')
    } else {
      wx.showToast({ title: result.error || '操作失败', icon: 'none' })
    }
  },
})

export {}
