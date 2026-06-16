const { sendSmsCode, resetPassword } = require('../../../services/index')

const COUNTDOWN_SECONDS = 60

Page({
  data: {
    phone: '',
    code: '',
    newPassword: '',
    confirmPassword: '',
    countdown: 0,
    canSendCode: false,
    submitting: false,
  },

  onPhoneInput(e: any) {
    const phone = e.detail.value || ''
    this.setData({ phone, canSendCode: /^1\d{10}$/.test(phone) && this.data.countdown === 0 })
  },

  onCodeInput(e: any) {
    this.setData({ code: e.detail.value || '' })
  },

  onNewPasswordInput(e: any) {
    this.setData({ newPassword: e.detail.value || '' })
  },

  onConfirmPasswordInput(e: any) {
    this.setData({ confirmPassword: e.detail.value || '' })
  },

  startCountdown() {
    this.setData({ countdown: COUNTDOWN_SECONDS, canSendCode: false })
    const timer = setInterval(() => {
      const next = this.data.countdown - 1
      if (next <= 0) {
        clearInterval(timer)
        this.setData({ countdown: 0, canSendCode: /^1\d{10}$/.test(this.data.phone) })
        return
      }
      this.setData({ countdown: next })
    }, 1000)
  },

  async onSendCode() {
    const { phone, countdown } = this.data
    if (countdown > 0) return
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' })
      return
    }

    wx.showLoading({ title: '发送中...' })
    const result = await sendSmsCode(phone, 'resetPassword')
    wx.hideLoading()

    if (result.success) {
      wx.showToast({ title: '验证码已发送', icon: 'success' })
      this.startCountdown()
    } else {
      wx.showToast({ title: result.error || '发送失败', icon: 'none' })
    }
  },

  async onSubmit() {
    const { phone, code, newPassword, confirmPassword, submitting } = this.data
    if (submitting) return

    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' })
      return
    }
    if (!code) {
      wx.showToast({ title: '请输入验证码', icon: 'none' })
      return
    }
    if (!newPassword || newPassword.length < 6) {
      wx.showToast({ title: '新密码至少 6 位', icon: 'none' })
      return
    }
    if (newPassword !== confirmPassword) {
      wx.showToast({ title: '两次输入密码不一致', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '重置中...' })

    const result = await resetPassword({ phone, code, newPassword })
    wx.hideLoading()
    this.setData({ submitting: false })

    if (result.success) {
      wx.showToast({ title: '密码重置成功', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1000)
    } else {
      wx.showToast({ title: result.error || '重置失败', icon: 'none' })
    }
  },

  onBackLogin() {
    wx.navigateBack()
  },
})

export {}
