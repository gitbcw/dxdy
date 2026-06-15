const { registerAccount, GENERATED_ASSETS, manageCardVoucher } = require('../../services/index')
const icons = require('../../services/icons')

type RegisterType = 'personal' | 'institution' | 'agent'

Page({
  data: {
    phone: '',
    password: '',
    confirmPassword: '',
    nickname: '',
    registerType: 'personal' as RegisterType,
    referralCode: '',
    redirect: '',
    bloodInvite: '',
    submitting: false,
    loginHeroImage: GENERATED_ASSETS.loginHero,
    phoneIcon: icons.phone,
    shieldIcon: icons.shield,
    logoIcon: icons.hospital,
    roleOptions: [
      { key: 'personal', title: '个人客户', desc: '个人预约、订单与账户服务' },
      { key: 'institution', title: '医院客户', desc: '认证后享受门店价格' },
      { key: 'agent', title: '代理商', desc: '提交资料审核后开通代理权益' },
    ],
  },

  onLoad(options: Record<string, string | undefined> = {}) {
    const scene = options.scene ? decodeURIComponent(options.scene) : ''
    this.setData({
      referralCode: options.referralCode || scene || '',
      redirect: options.redirect ? decodeURIComponent(options.redirect) : '',
      bloodInvite: options.bloodInvite || '',
      registerType: (options.type === 'institution' || options.type === 'agent') ? options.type : 'personal',
    })
    if (this.data.referralCode) {
      manageCardVoucher({ action: 'recordAgentPromoVisit', referralCode: this.data.referralCode }).catch(() => null)
    }
  },

  onInput(e: any) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  onRoleTap(e: any) {
    this.setData({ registerType: e.currentTarget.dataset.key as RegisterType })
  },

  validateForm() {
    const phone = this.data.phone.trim()
    const password = this.data.password
    const confirmPassword = this.data.confirmPassword
    if (!/^1\d{10}$/.test(phone)) return '请输入正确手机号'
    if (!password || password.length < 6) return '密码至少 6 位'
    if (password !== confirmPassword) return '两次输入的密码不一致'
    return ''
  },

  async onSubmit() {
    const message = this.validateForm()
    if (message) {
      wx.showToast({ title: message, icon: 'none' })
      return
    }
    if (this.data.submitting) return

    this.setData({ submitting: true })
    wx.showLoading({ title: '注册中...' })
    const result = await registerAccount({
      phone: this.data.phone.trim(),
      password: this.data.password,
      nickname: this.data.nickname.trim() || `用户${this.data.phone.slice(-4)}`,
      registerType: this.data.registerType,
      referralCode: this.data.referralCode,
    })
    wx.hideLoading()
    this.setData({ submitting: false })

    if (!result.success) {
      wx.showToast({ title: result.error || '注册失败', icon: 'none' })
      return
    }

    wx.showToast({ title: '注册成功', icon: 'success' })
    setTimeout(() => {
      if (this.data.redirect) {
        wx.redirectTo({ url: this.data.redirect })
        return
      }
      if (this.data.bloodInvite) {
        wx.redirectTo({ url: `/pages/blood/booking/booking?invite=${encodeURIComponent(this.data.bloodInvite)}` })
        return
      }
      if (this.data.registerType === 'institution') {
        wx.redirectTo({ url: '/pages/verify/verify' })
        return
      }
      if (this.data.registerType === 'agent') {
        wx.redirectTo({ url: '/pages/agent/apply/apply' })
        return
      }
      wx.switchTab({ url: '/pages/home/home' })
    }, 500)
  },

  onLoginTap() {
    wx.navigateBack()
  },
})

export {}
