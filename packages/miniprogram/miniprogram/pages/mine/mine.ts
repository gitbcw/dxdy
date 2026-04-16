const { formatMoney } = require('../../services/index')
const icons = require('../../services/icons')

Page({
  data: {
    userInfo: null as any,
    balance: '0.00',
    points: 0,
    currentRole: 'customer_personal',
    userRoleLabel: '个人消费者',
    menuItems: [] as any[],
    iconOrder: icons.order,
    iconHelp: icons.help,
    iconInfo: icons.info,
    iconWallet: icons.wallet,
    iconCoupon: icons.coupon,
    iconSwitch: icons.refresh,
    iconPeople: icons.people,
    iconShare: icons.share,
    iconClock: icons.clock,
  },

  onShow() {
    this.loadUserInfo()
  },

  loadUserInfo() {
    const app = getApp()
    const user = app.globalData.userInfo
    const userRole = app.globalData.userRole as string || 'customer_personal'

    if (user) {
      // 根据 userRole 确定标签和菜单
      let userRoleLabel = '个人消费者'
      let menuRole = 'customer'

      if (userRole === 'customer_institution') {
        userRoleLabel = '机构客户'
        menuRole = 'customer'
      } else if (userRole === 'customer_personal') {
        userRoleLabel = '个人消费者'
        menuRole = 'customer'
      } else if (userRole === 'salesperson') {
        userRoleLabel = '业务员'
        menuRole = 'salesperson'
      } else if (userRole === 'clerk') {
        userRoleLabel = '制单员'
        menuRole = 'clerk'
      }

      this.setData({
        userInfo: user,
        balance: formatMoney(user.wallet?.balance ?? 0),
        points: user.points?.balance ?? 0,
        currentRole: userRole,
        userRoleLabel,
        menuItems: this.getMenuItems(menuRole),
      })
    } else {
      this.setData({ userInfo: null, menuItems: [] })
    }
  },

  // 获取当前角色的菜单项
  getMenuItems(role: string, customerType?: string): any[] {
    const commonIcons = {
      order: icons.order,
      help: icons.help,
      info: icons.info,
      switch: icons.refresh,
    }

    // 客户角色（个人消费者/机构客户）
    if (role === 'customer') {
      return [
        { id: 'orders', icon: commonIcons.order, title: '我的订单', tap: 'onOrdersTap', iconClass: '' },
        { id: 'address', icon: commonIcons.info, title: '收货地址', tap: 'onAddressTap', iconClass: '' },
        { id: 'help', icon: commonIcons.help, title: '帮助中心', tap: 'onHelpTap', iconClass: '' },
        { id: 'about', icon: commonIcons.info, title: '关于我们', tap: 'onAboutTap', iconClass: '' },
        { id: 'switch', icon: commonIcons.switch, title: '切换身份', tap: 'onSwitchRole', iconClass: 'switch' },
      ]
    }

    // 业务员角色
    if (role === 'salesperson') {
      return [
        { id: 'orders', icon: commonIcons.order, title: '我的订单', tap: 'onOrdersTap', iconClass: '' },
        { id: 'commission', icon: icons.wallet, title: '我的佣金', tap: 'onCommissionTap', iconClass: 'accent' },
        { id: 'customers', icon: icons.people, title: '客户管理', tap: 'onCustomersTap', iconClass: '' },
        { id: 'promote', icon: icons.share, title: '推广工具', tap: 'onPromoteTap', iconClass: '' },
        { id: 'help', icon: commonIcons.help, title: '帮助中心', tap: 'onHelpTap', iconClass: '' },
        { id: 'switch', icon: commonIcons.switch, title: '切换身份', tap: 'onSwitchRole', iconClass: 'switch' },
      ]
    }

    // 制单员角色
    if (role === 'clerk') {
      return [
        { id: 'pending', icon: icons.clock, title: '待处理订单', tap: 'onPendingOrdersTap', iconClass: 'accent' },
        { id: 'allorders', icon: commonIcons.order, title: '全部订单', tap: 'onAllOrdersTap', iconClass: '' },
        { id: 'profile', icon: commonIcons.info, title: '个人信息', tap: 'onProfileTap', iconClass: '' },
        { id: 'switch', icon: commonIcons.switch, title: '切换身份', tap: 'onSwitchRole', iconClass: 'switch' },
      ]
    }

    // 默认返回客户菜单
    return [
      { id: 'orders', icon: commonIcons.order, title: '我的订单', tap: 'onOrdersTap', iconClass: '' },
      { id: 'switch', icon: commonIcons.switch, title: '切换身份', tap: 'onSwitchRole', iconClass: 'switch' },
    ]
  },

  // 菜单项点击处理
  onMenuItemTap(e: any) {
    const id = e.currentTarget.dataset.id
    const item = this.data.menuItems.find((m: any) => m.id === id)
    if (item && this[item.tap]) {
      this[item.tap]()
    }
  },

  // 切换角色 - 弹出选择菜单
  onSwitchRole() {
    const roleList = [
      { role: 'customer_personal', name: '个人消费者', desc: '零售购买' },
      { role: 'customer_institution', name: '机构客户', desc: '企业账号采购' },
      { role: 'salesperson', name: '业务员', desc: '推广拿佣金' },
      { role: 'clerk', name: '制单员', desc: '处理订单发货' },
    ]

    const itemList = roleList.map(r => `${r.name}（${r.desc}）`)

    wx.showActionSheet({
      itemList,
      success: (res) => {
        const selected = roleList[res.tapIndex]
        if (selected.role === this.data.currentRole) return

        wx.showLoading({ title: '切换中...' })
        const app = getApp()
        app.switchDemoRole(selected.role)

        setTimeout(() => {
          wx.hideLoading()
          this.loadUserInfo()
          wx.showToast({
            title: `已切换为${selected.name}`,
            icon: 'success',
            duration: 1500,
          })
          wx.switchTab({ url: '/pages/home/home' })
        }, 300)
      },
    })
  },

  // 客户菜单项
  onOrdersTap() {
    wx.navigateTo({ url: '/pages/orders/order-detail/order-detail?list=1' })
  },

  onAddressTap() {
    wx.showToast({ title: '地址管理开发中', icon: 'none' })
  },

  onHelpTap() {
    wx.showToast({ title: '帮助中心开发中', icon: 'none' })
  },

  onAboutTap() {
    wx.showToast({ title: '关于我们开发中', icon: 'none' })
  },

  // 业务员菜单项
  onCommissionTap() {
    wx.navigateTo({ url: '/pages/salesman/commission/commission' })
  },

  onCustomersTap() {
    wx.navigateTo({ url: '/pages/salesman/customers/customers' })
  },

  onPromoteTap() {
    wx.navigateTo({ url: '/pages/salesman/promote/promote' })
  },

  // 制单员菜单项
  onPendingOrdersTap() {
    wx.navigateTo({ url: '/pages/clerk/pending/pending' })
  },

  onAllOrdersTap() {
    wx.navigateTo({ url: '/pages/clerk/orders/orders' })
  },

  onProfileTap() {
    wx.showToast({ title: '个人信息开发中', icon: 'none' })
  },
})
