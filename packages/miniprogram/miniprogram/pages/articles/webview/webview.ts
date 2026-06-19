const tracking = require('../../../services/tracking')

Page({
  data: {
    url: '',
    title: '内容精选',
    statusBarHeight: 20,
    navBarHeight: 64,
    webviewTop: 63,
    capsuleRight: 0,
  },

  onLoad(options: any) {
    const url = options.url ? decodeURIComponent(options.url) : ''
    const title = options.title ? decodeURIComponent(options.title) : '内容精选'
    const articleId = options.id || ''
    const { statusBarHeight = 20, windowWidth = 375 } = wx.getSystemInfoSync()
    const capsule = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null

    const capsuleHeight = capsule ? capsule.height : 32
    const capsuleTop = capsule ? capsule.top : statusBarHeight + 6
    const navBarHeight = capsule ? capsule.bottom + (capsuleTop - statusBarHeight) : statusBarHeight + 44
    const capsuleRight = windowWidth - (capsule ? capsule.right : windowWidth - 10)

    this.setData({
      url,
      title,
      statusBarHeight,
      navBarHeight,
      webviewTop: navBarHeight - 1,
      capsuleRight,
    })
    if (title) wx.setNavigationBarTitle({ title })
    if (articleId) tracking.trackArticleView(articleId, title)
  },

  onBackTap() {
    wx.navigateBack({ delta: 1 })
  },
})

export {}
