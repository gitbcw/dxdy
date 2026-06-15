const { getAgentCommissionOverview, formatMoney } = require('../../../services/index')

Page({
  data: {
    summary: null as any,
    canWithdraw: false,
    records: [] as any[],
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    wx.showLoading({ title: '加载中...' })
    try {
      const { summary, records } = await getAgentCommissionOverview()

      // 格式化提成记录
      const formattedRecords = records.map((r: any) => {
        const signedAmount = this.getSignedAmount(r)
        return {
          ...r,
          amountText: `${signedAmount >= 0 ? '+' : '-'}${formatMoney(Math.abs(signedAmount))}`,
          amountClass: signedAmount >= 0 ? 'positive' : 'negative',
          sourceLabel: this.getSourceLabel(r.sourceType),
          statusLabel: this.getStatusLabel(r.status),
        }
      })

      this.setData({
        summary: {
          ...summary,
          total: formatMoney(summary.total || 0),
          pending: formatMoney(summary.pending || summary.pendingLock || 0),
          withdrawable: formatMoney(summary.withdrawable || 0),
          withdrawn: formatMoney(summary.withdrawn || 0),
        },
        canWithdraw: (summary.withdrawable || 0) >= 100,
        records: formattedRecords,
      })
    } catch (e) {
      console.error('load commission failed', e)
      wx.showToast({ title: '提成数据加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  getSourceLabel(type: string): string {
    const map: Record<string, string> = {
      order: '订单提成',
      return_deduction: '退货扣减',
      exchange_adjustment: '换货调整',
      price_modification: '改价调整',
    }
    return map[type] || type
  },

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: '待核算',
      locked: '冻结中',
      settled: '可提现',
      deducted: '已扣减',
      cancelled: '已取消',
    }
    return map[status] || status || '同步中'
  },

  getSignedAmount(record: any): number {
    const amount = Number(record?.signedAmount ?? record?.amount ?? 0) || 0
    if (record?.status === 'deducted' || record?.sourceType === 'return_deduction') return -Math.abs(amount)
    return amount
  },

  onWithdraw() {
    wx.navigateTo({ url: '/pages/agent/withdraw/withdraw' })
  },
})
