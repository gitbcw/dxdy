const { getTestReportByCode, formatDateTime } = require('../../../services/index')

const HISTORY_KEY = 'test_report_query_history'

function readHistory() {
  try {
    const stored = wx.getStorageSync(HISTORY_KEY)
    if (Array.isArray(stored)) return stored
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveHistory(code: string) {
  const now = formatDateTime(new Date())
  const history = readHistory().filter((item: any) => item.code !== code)
  const next = [{ code, time: now }, ...history].slice(0, 5)
  wx.setStorageSync(HISTORY_KEY, JSON.stringify(next))
  return next
}

Page({
  data: {
    code: '',
    history: [] as any[],
    querying: false,
  },

  onShow() {
    this.setData({ history: readHistory() })
  },

  onInput(e: any) {
    this.setData({ code: e.detail.value })
  },

  onScan() {
    wx.scanCode({
      success: (res) => {
        this.setData({ code: res.result })
        this.onQuery()
      },
    })
  },

  async onQuery() {
    if (this.data.querying) return
    const code = this.data.code.trim()
    if (!code) {
      wx.showToast({ title: '请输入血包编号或检测码', icon: 'none' })
      return
    }
    this.setData({ querying: true })
    wx.showLoading({ title: '查询中...' })
    const report = await getTestReportByCode(code)
    wx.hideLoading()
    this.setData({ querying: false })

    if (!report) {
      wx.showToast({ title: '未找到检测报告', icon: 'none' })
      return
    }

    this.setData({ history: saveHistory(report.code || code) })
    wx.navigateTo({ url: `/pages/tests/report/report?code=${report.code || code}` })
  },

  onHistoryTap(e: any) {
    wx.navigateTo({ url: `/pages/tests/report/report?code=${e.currentTarget.dataset.code}` })
  },
})

export {}
