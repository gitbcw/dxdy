const { formatMoney } = require('../../../services/index')

Page({
  data: {
    balance: 0,
    tiers: [] as any[],
    selectedIndex: -1,
    loading: false,
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    const app = getApp()
    const user = app.globalData.userInfo
    if (!user) return

    const db = wx.cloud.database()
    const [userRes, configRes] = await Promise.all([
      db.collection('users').doc(user.id || user._id).get(),
      db.collection('config').doc('system').get(),
    ])

    const tiers = (configRes.data?.rechargeTiers || []).map((t: any, i: number) => ({
      ...t,
      index: i,
      amountText: formatMoney(t.amount),
      bonusText: t.bonus > 0 ? `赠 ¥${formatMoney(t.bonus)}` : '',
      label: t.label || `充值 ¥${t.amount}`,
    }))

    this.setData({
      balance: userRes.data?.wallet?.balance || 0,
      tiers,
    })
  },

  onTierTap(e: any) {
    const idx = e.currentTarget.dataset.idx
    this.setData({ selectedIndex: idx })
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
      // 创建充值订单
      const { result: createResult } = await wx.cloud.callFunction({
        name: 'createRechargeOrder',
        data: { tierIndex: selectedIndex },
      }) as any

      if (!createResult?.success) {
        wx.showToast({ title: createResult?.error || '创建失败', icon: 'none' })
        return
      }

      // 模拟支付
      const { result: payResult } = await wx.cloud.callFunction({
        name: 'payOrder',
        data: { orderId: createResult.order.id, method: 'wechat' },
      }) as any

      if (!payResult?.success) {
        wx.showToast({ title: payResult?.error || '支付失败', icon: 'none' })
        return
      }

      const tier = tiers[selectedIndex]
      wx.showToast({ title: `充值成功，到账 ¥${formatMoney(tier.amount + tier.bonus)}`, icon: 'success' })
      this.setData({ selectedIndex: -1 })
      this.loadData()
    } catch (err: any) {
      wx.showToast({ title: err?.message || '充值失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
})

export {}
