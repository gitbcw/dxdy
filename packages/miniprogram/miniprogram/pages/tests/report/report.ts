const { GENERATED_ASSETS, getTestReportByCode } = require('../../../services/index')
const icons = require('../../../services/icons')

function mapItems(items: any[]) {
  return (items || []).map((item: any) => {
    if (typeof item === 'string') return { name: item, result: '合格' }
    return {
      name: item.name || item.title || item.item || '检测项目',
      result: item.result || item.status || '合格',
    }
  })
}

Page({
  data: {
    code: '',
    product: '',
    batch: '',
    bloodType: '',
    collectedAt: '',
    testedAt: '',
    validUntil: '',
    items: [] as any[],
    storage: '',
    transport: '',
    conclusion: '',
    reportFileID: '',
    isEmpty: false,
    testIcon: icons.test,
    traceabilityImage: GENERATED_ASSETS.testTraceability,
  },

  onLoad(options: any) {
    if (options.code) {
      this.loadReport(options.code)
    } else {
      this.setData({ isEmpty: true })
    }
  },

  async loadReport(code: string) {
    const report = await getTestReportByCode(code)
    if (!report) {
      wx.showToast({ title: '报告不存在', icon: 'none' })
      this.setData({ code, isEmpty: true })
      return
    }
    this.setData({
      code: report.code || code,
      product: report.productName || '',
      batch: report.batchNo || '',
      bloodType: report.bloodType || '未标注',
      collectedAt: report.collectedAt || '',
      testedAt: report.testedAt || '',
      validUntil: report.validUntil || '',
      items: mapItems(report.items),
      storage: report.storage || '按标签要求储存',
      transport: report.transport || '冷链运输',
      conclusion: report.conclusion || '检测结论待后台维护',
      reportFileID: report.reportFileID || '',
      isEmpty: false,
    })
  },

  onDownload() {
    if (!this.data.reportFileID) {
      wx.showToast({ title: '暂无报告文件', icon: 'none' })
      return
    }
    wx.showLoading({ title: '打开中...' })
    wx.cloud.downloadFile({
      fileID: this.data.reportFileID,
      success: (res) => {
        wx.hideLoading()
        wx.openDocument({
          filePath: res.tempFilePath,
          showMenu: true,
          fail: () => wx.showToast({ title: '文件打开失败', icon: 'none' }),
        })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '文件下载失败', icon: 'none' })
      },
    })
  },
})

export {}
