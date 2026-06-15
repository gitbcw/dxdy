const { getVisibleTabList, normalizePath } = require('../utils/tab-bar')
const icons = require('../services/icons')

Component({
  data: {
    hidden: false,
    selectedPath: '/pages/home/home',
    tabs: [] as Array<{ pagePath: string, text: string, icon?: string, activeIcon?: string }>,
  },

  methods: {
    sync(role?: string) {
      const app = getApp<IAppOption>()
      const currentRole = role || app.globalData.userRole || 'customer_institution'
      this.setData({
        tabs: getVisibleTabList(currentRole).map((item: any) => ({
          ...item,
          iconSrc: icons.iconByKey[item.icon] || icons.home,
        })),
      })
    },

    updateForPage(path: string, role?: string) {
      this.sync(role)
      this.setData({
        hidden: false,
        selectedPath: normalizePath(path),
      })
    },

    setHidden(hidden: boolean) {
      this.setData({ hidden })
    },

    onTabTap(e: any) {
      const path = e.currentTarget.dataset.path
      if (!path || path === this.data.selectedPath) return

      wx.switchTab({ url: path })
    },
  },
})

export {}
