const { getVisibleTabList, normalizePath } = require('../utils/tab-bar')

Component({
  data: {
    selectedPath: '/pages/home/home',
    tabs: [] as Array<{ pagePath: string, text: string }>,
  },

  methods: {
    sync(role?: string) {
      const app = getApp<IAppOption>()
      const currentRole = role || app.globalData.userRole || 'customer_personal'
      this.setData({
        tabs: getVisibleTabList(currentRole),
      })
    },

    updateForPage(path: string, role?: string) {
      this.sync(role)
      this.setData({
        selectedPath: normalizePath(path),
      })
    },

    onTabTap(e: any) {
      const path = e.currentTarget.dataset.path
      if (!path || path === this.data.selectedPath) return

      wx.switchTab({ url: path })
    },
  },
})

export {}
