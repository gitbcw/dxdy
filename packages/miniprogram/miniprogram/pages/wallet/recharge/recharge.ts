const { formatMoney, getOrderById, getSystemConfig, payOrder } = require('../../../services/index')

Page({
  data: {
    balance: 0,
    pointsBalance: 0,
    pointsValueText: '0.00',
    pointsRuleText: '100积分=1元，下单时可用于抵扣订单金额',
    tiers: [] as any[],
    selectedIndex: -1,
    loading: false,
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    const app = getApp()
    const user = await this.refreshCurrentUser() || app.globalData.userInfo
    if (!user) return

    const config = await getSystemConfig()

    const tiers = (config?.rechargeTiers || [])
      .filter((t: any) => Number(t.amount) > 0)
      .map((t: any, i: number) => ({
        ...t,
        index: i,
        amountText: formatMoney(t.amount),
        bonusText: t.bonus > 0 ? `赠 ¥${formatMoney(t.bonus)}` : '',
        label: t.label || `充值 ¥${t.amount}`,
      }))

    this.setData({
      balance: user.wallet?.balance || 0,
      pointsBalance: user.points?.balance || 0,
      pointsValueText: formatMoney(Math.floor((user.points?.balance || 0) / 100)),
      pointsRuleText: `100积分=1元，下单时可用于抵扣订单金额；订单完成后按实付金额每1元赠送${config?.pointsRate || 1}积分`,
      tiers,
    })
  },

  onTierTap(e: any) {
    const idx = e.currentTarget.dataset.idx
    this.setData({ selectedIndex: idx })
  },

  async waitForPaymentResult(orderId: string) {
    for (let i = 0; i < 8; i += 1) {
      const order = await getOrderById(orderId)
      if (order?.payment?.status === 'paid' || order?.status === 'completed') return order
      await new Promise(resolve => setTimeout(resolve, 1200))
    }
    return null
  },

  async refreshCurrentUser() {
    const app = getApp()
    const current = app.globalData.userInfo
    const userId = current?.id || current?._id
    if (!userId) return null

    const { result } = await wx.cloud.callFunction({
      name: 'createRechargeOrder',
      data: { action: 'getCurrentUser', operatorId: userId },
    }) as any
    if (!result?.success || !result.user) return null

    const user = result.user
    app.globalData.userInfo = user
    app.globalData.userRole = app.resolveRole?.(user) || app.globalData.userRole
    wx.setStorageSync('current_user', JSON.stringify(user))
    return user
  },

  async onRechargeTap() {
    const { selectedIndex, tiers } = this.data
    if (selectedIndex < 0 || selectedIndex >= tiers.length) {
      wx.showToast({ title: '请选择充值档位', icon: 'none' })
      return
    }

    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'createRechargeOrder',
        data: { tierIndex: selectedIndex, operatorId: getApp().globalData.userInfo?.id },
      }) as any

      if (!result?.success) {
        wx.showToast({ title: result?.error || '充值订单创建失败', icon: 'none' })
        return
      }

      const orderId = result.order?.id || result.recharge?.orderId
      if (!orderId) {
        wx.showToast({ title: '充值订单创建失败', icon: 'none' })
        return
      }

      const payResult = await payOrder(orderId, 'wechat')
      if (!payResult?.success) {
        wx.showToast({ title: payResult?.error || '微信支付下单失败', icon: 'none' })
        return
      }
      if (!payResult.payment) {
        wx.showToast({ title: '微信支付参数缺失', icon: 'none' })
        return
      }

      await new Promise<void>((resolve, reject) => {
        wx.requestPayment({
          ...payResult.payment,
          success: () => resolve(),
          fail: (err: WechatMiniprogram.GeneralCallbackResult) => reject(err),
        })
      })

      wx.showLoading({ title: '确认充值结果', mask: true })
      const paidOrder = await this.waitForPaymentResult(orderId)
      wx.hideLoading()

      if (!paidOrder) {
        wx.showToast({ title: '支付已完成，充值结果确认中', icon: 'none' })
        return
      }

      const user = await this.refreshCurrentUser()
      const tier = tiers[selectedIndex]
      wx.showToast({ title: `充值成功，到账 ¥${formatMoney(tier.amount + tier.bonus)}`, icon: 'success' })
      this.setData({ selectedIndex: -1 })

      if (user) {
        this.setData({
          balance: user.wallet?.balance || 0,
          pointsBalance: user.points?.balance || 0,
          pointsValueText: formatMoney(Math.floor((user.points?.balance || 0) / 100)),
        })
      } else {
        this.loadData()
      }
    } catch (err: any) {
      const message = String(err?.errMsg || err?.message || '')
      wx.showToast({
        title: message.includes('cancel') ? '已取消支付' : '充值失败',
        icon: 'none',
      })
    } finally {
      wx.hideLoading()
      this.setData({ loading: false })
    }
  },
})

export {}
