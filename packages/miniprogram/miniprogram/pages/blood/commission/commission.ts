const { getBloodCommissionRecords, formatMoney } = require('../../../services/index')

function getStatusText(status: string) {
  const map: Record<string, string> = {
    pending_payment: '待支付',
    locked: '冻结中',
    settled: '已结算',
    cancelled: '已取消',
  }
  return map[status] || status || '未知'
}

Page({
  data: {
    loading: true,
    records: [] as any[],
    summary: {
      locked: '0.00',
      settled: '0.00',
      cancelled: '0.00',
    },
  },

  onShow() {
    this.loadRecords()
  },

  async loadRecords() {
    const user = getApp().globalData.userInfo
    if (!user?.id) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }

    this.setData({ loading: true })
    try {
      const rows = await getBloodCommissionRecords()
      const records = rows.map((item: any) => ({
        ...item,
        amountText: formatMoney(item.amount || 0),
        storePriceText: formatMoney(item.storePrice || 0),
        retailPriceText: formatMoney(item.retailPrice || 0),
        statusText: getStatusText(item.status),
      }))
      const locked = records
        .filter((item: any) => item.status === 'locked' || item.status === 'pending_payment')
        .reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0)
      const settled = records
        .filter((item: any) => item.status === 'settled')
        .reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0)
      const cancelled = records
        .filter((item: any) => item.status === 'cancelled')
        .reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0)

      this.setData({
        records,
        summary: {
          locked: formatMoney(locked),
          settled: formatMoney(settled),
          cancelled: formatMoney(cancelled),
        },
      })
    } catch (_err) {
      wx.showToast({ title: '读取提成失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
})

export {}
