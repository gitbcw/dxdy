const { formatMoney, getSystemConfig } = require('../../../services/index')

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
    const user = app.globalData.userInfo
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
      pointsRuleText: `100积分=1元，下单时可用于抵扣订单金额；订单完成后按实付金额×${config?.pointsRate || 1}赠送积分`,
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
      const { result } = await wx.cloud.callFunction({
        name: 'createRechargeOrder',
        data: { tierIndex: selectedIndex, operatorId: getApp().globalData.userInfo?.id },
      }) as any

      if (!result?.success) {
        wx.showToast({ title: result?.error || '充值失败', icon: 'none' })
        return
      }

      if (result.user) {
        const app = getApp()
        app.globalData.userInfo = result.user
        app.globalData.userRole = app.resolveRole?.(result.user) || app.globalData.userRole
        wx.setStorageSync('current_user', JSON.stringify(result.user))
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
