const { getReturns, getReturnById, getOrderById, formatMoney, updateReturnLogistics } = require('../../../services/index')

const stepDefs = [
  { key: 'submitted', title: '提交申请' },
  { key: 'pending_review', title: '商家审核中' },
  { key: 'approved', title: '审核通过' },
  { key: 'customer_shipping', title: '等待寄回' },
  { key: 'received', title: '商品质检' },
  { key: 'refunding', title: '退款中' },
  { key: 'return_completed', title: '已完成' },
]

Page({
  data: {
    afterNo: '',
    statusText: '商家审核中',
    statusDesc: '我们将在 24 小时内完成审核，请耐心等待',
    record: null as any,
    order: null as any,
    refundAmount: '0.00',
    steps: [] as any[],
    note: '已收到您的凭证，正在核实，请保持电话畅通。',
    showLogisticsForm: false,
    sendCompany: '',
    sendTrackingNo: '',
  },

  onLoad(options: any) {
    if (options.id) {
      this.loadReturn(options.id)
      return
    }
    if (options.orderId) {
      this.loadByOrder(options.orderId)
    }
  },

  async loadByOrder(orderId: string) {
    const records = await getReturns({ orderId })
    if (records[0]) {
      this.applyRecord(records[0])
      return
    }
    wx.showToast({ title: '暂无售后记录', icon: 'none' })
  },

  async loadReturn(id: string) {
    const record = await getReturnById(id)
    if (!record) {
      wx.showToast({ title: '售后记录不存在', icon: 'none' })
      return
    }
    this.applyRecord(record)
  },

  async applyRecord(record: any) {
    const order = record.orderId ? await getOrderById(record.orderId) : null
    this.setData({
      record,
      order,
      afterNo: record.afterNo || record.id,
      statusText: this.getStatusText(record.status),
      statusDesc: this.getStatusDesc(record.status),
      refundAmount: formatMoney(record.refundAmount || 0),
      steps: this.buildSteps(record),
      note: record.reviewNote || this.data.note,
      showLogisticsForm: record.status === 'customer_shipping' && !record.sendLogistics,
    })
  },

  buildSteps(record: any) {
    const timeline = record.timeline || []
    const activeIndex = Math.max(1, stepDefs.findIndex((step) => step.key === record.status))
    return stepDefs.map((step, index) => {
      const item = timeline.find((entry: any) => entry.status === step.key)
      return {
        title: step.title,
        time: item?.time || '--',
        active: index <= activeIndex,
      }
    })
  },

  getStatusText(status: string) {
    const map: Record<string, string> = {
      pending_review: '商家审核中',
      approved: '审核已通过',
      rejected: '审核未通过',
      customer_shipping: '等待寄回',
      received: '商品质检中',
      refunding: '退款处理中',
      return_completed: '售后已完成',
    }
    return map[status] || '售后处理中'
  },

  getStatusDesc(status: string) {
    const map: Record<string, string> = {
      pending_review: '我们将在 24 小时内完成审核，请耐心等待',
      approved: '请按照客服指引继续处理退货或退款',
      rejected: '可联系客服了解原因或重新提交材料',
      refunding: '退款将原路退回，请留意到账信息',
      return_completed: '本次售后服务已完成',
    }
    return map[status] || '售后流程正在推进'
  },

  onCopy() {
    wx.setClipboardData({ data: this.data.afterNo })
  },

  onSendCompanyInput(e: any) {
    this.setData({ sendCompany: e.detail.value })
  },

  onSendTrackingNoInput(e: any) {
    this.setData({ sendTrackingNo: e.detail.value })
  },

  async onSubmitLogistics() {
    const { record, sendCompany, sendTrackingNo } = this.data
    if (!record) return
    if (!sendCompany.trim() || !sendTrackingNo.trim()) {
      wx.showToast({ title: '请填写快递公司和单号', icon: 'none' })
      return
    }
    wx.showLoading({ title: '提交中...' })
    try {
      await updateReturnLogistics(record.id, {
        company: sendCompany.trim(),
        trackingNo: sendTrackingNo.trim(),
      })
      wx.hideLoading()
      wx.showToast({ title: '提交成功' })
      // 重新加载记录
      if (record.id) this.loadReturn(record.id)
      else if (record.orderId) this.loadByOrder(record.orderId)
    } catch (err: any) {
      wx.hideLoading()
      wx.showToast({ title: err?.message || '提交失败', icon: 'none' })
    }
  },
})

export {}
