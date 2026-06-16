Page({
  data: {
    url: '',
  },

  onLoad(options: any) {
    const url = options.url ? decodeURIComponent(options.url) : ''
    const title = options.title ? decodeURIComponent(options.title) : '内容精选'
    if (title) wx.setNavigationBarTitle({ title })
    this.setData({ url })
  },
})

export {}
