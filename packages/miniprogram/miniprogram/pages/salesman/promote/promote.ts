const icons = require('../../../services/icons')

function buildPromoCode(userId: string) {
  const points = [
    [0, 0], [1, 0], [3, 0], [4, 0], [6, 0], [7, 0],
    [0, 1], [2, 1], [5, 1], [7, 1],
    [1, 2], [3, 2], [4, 2], [6, 2],
    [0, 3], [2, 3], [5, 3], [7, 3],
    [1, 4], [3, 4], [4, 4], [6, 4],
    [0, 5], [2, 5], [5, 5], [7, 5],
    [0, 6], [1, 6], [3, 6], [4, 6], [6, 6], [7, 6],
    [2, 7], [5, 7],
  ]

  const hash = userId.split('').reduce((sum: number, char: string, index: number) => sum + char.charCodeAt(0) * (index + 1), 0)
  const blocks = points
    .filter((_, index) => (index + hash) % 3 !== 0)
    .map(([x, y]) => `<rect x="${70 + x * 32}" y="${70 + y * 32}" width="24" height="24" rx="4" fill="#0A6E7C" />`)
    .join('')

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <rect width="400" height="400" rx="36" fill="#FFFFFF"/>
      <rect x="28" y="28" width="344" height="344" rx="28" fill="#F4FBFA" stroke="#D6ECE8" stroke-width="4"/>
      <rect x="52" y="52" width="296" height="296" rx="24" fill="#FFFFFF"/>
      ${blocks}
      <text x="200" y="320" font-size="22" fill="#173236" text-anchor="middle" font-family="sans-serif">专属推广演示码</text>
      <text x="200" y="350" font-size="18" fill="#5F7275" text-anchor="middle" font-family="sans-serif">业务员 ${userId}</text>
    </svg>
  `

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

Page({
  data: {
    icons,
    qrcodeUrl: '',
    userId: '',
  },

  onLoad() {
    const app = getApp()
    const user = app.globalData.userInfo
    const userId = user?.id || 'unknown'

    this.setData({
      userId,
      qrcodeUrl: buildPromoCode(userId),
    })
    wx.showShareMenu({ withShareTicket: true })
  },

  onSaveQrcode() {
    wx.showToast({ title: '演示码可长按图片保存', icon: 'none' })
  },

  onShareAppMessage() {
    return {
      title: '大熊动医小程序邀请注册',
      path: '/pages/login/login',
    }
  },
})

export {}
