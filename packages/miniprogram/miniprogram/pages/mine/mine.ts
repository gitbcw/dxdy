const {
  formatMoney,
  getOrders,
  getClerkOrders,
  getCommissionSummary,
} = require('../../services/index')
const { normalizePath } = require('../../utils/tab-bar')

Page({
  data: {
    userInfo: null as any,
    currentRole: 'customer_personal',
    userRoleLabel: '个人客户',
    avatarText: '客',
    stats: [] as any[],
    statNote: '',
    compactProfile: false,
    showOrderBar: false,
    orderCounts: { all: 0, pendingPayment: 0, pendingReceipt: 0, completed: 0 },
    focusTitle: '',
    focusItems: [] as any[],
    menuItems: [] as any[],
  },

  onShow() {
    this.syncTabBar()
    this.loadUserInfo()
  },

  syncTabBar() {
    const tabBar = (this as any).getTabBar?.()
    tabBar?.updateForPage?.(normalizePath('/pages/mine/mine'))
  },

  async loadUserInfo() {
    const app = getApp()
    const user = app.globalData.userInfo
    const userRole = app.globalData.userRole as string || 'customer_personal'

    if (!user) {
      this.setData({ userInfo: null, menuItems: [], focusItems: [], showOrderBar: false, compactProfile: false, statNote: '' })
      return
    }

    const roleData = await this.getRoleCopy(userRole, user)
    this.setData({
      userInfo: user,
      currentRole: userRole,
      ...roleData,
    })
  },

  async getRoleCopy(role: string, user: any) {
    if (role === 'salesperson') {
      const summary = await getCommissionSummary()
      return {
        userRoleLabel: '业务员',
        avatarText: user.nickname?.[0] || '业',
        stats: [
          { label: '累计提成', value: `¥${formatMoney(summary.total)}` },
          { label: '可提现', value: `¥${formatMoney(summary.available)}` },
        ],
        statNote: `待抵扣 ¥${formatMoney(summary.pendingDeduction)}`,
        compactProfile: true,
        showOrderBar: false,
        orderCounts: { all: 0, pendingPayment: 0, pendingReceipt: 0, completed: 0 },
        focusTitle: '',
        focusItems: [],
        menuItems: [
          { id: 'promote', title: '推广工具', tap: 'onPromoteTap', accent: false, desc: '查看推广二维码' },
          { id: 'commission', title: '我的佣金', tap: 'onCommissionTap', desc: '查看提成明细和提现' },
          { id: 'profile', title: '个人资料', tap: 'onProfileTap', desc: '修改头像、昵称等基本信息' },
          { id: 'help', title: '帮助中心', tap: 'onHelpTap', desc: '常见问题与在线客服' },
        ],
      }
    }

    if (role === 'clerk') {
      const [pending, shipped] = await Promise.all([
        getClerkOrders({ status: 'pending' }),
        getClerkOrders({ status: 'shipped' }),
      ])
      const exchangeCount = pending.filter((order: any) => order.type === 'exchange').length
      return {
        userRoleLabel: '制单员',
        avatarText: user.nickname?.[0] || '制',
        stats: [
          { label: '待处理', value: String(pending.length) },
          { label: '已发货', value: String(shipped.length) },
        ],
        statNote: exchangeCount > 0 ? `当前含换货单 ${exchangeCount} 单` : '当前暂无换货单待处理',
        compactProfile: true,
        showOrderBar: false,
        orderCounts: { all: 0, pendingPayment: 0, pendingReceipt: 0, completed: 0 },
        focusTitle: '当前待处理',
        focusItems: [
          {
            id: 'pending-summary',
            badge: exchangeCount > 0 ? '含换货单' : '待发货',
            title: pending.length > 0 ? `${pending.length} 单待处理` : '暂无待处理订单',
            desc: pending.length > 0
              ? `普通发货与换货发货统一从待处理订单进入`
              : '当前没有待处理发货任务',
            meta: pending[0]
              ? `最近订单：${pending[0].orderNo} · ${pending[0].customerName}`
              : '进入待处理订单查看后续任务',
            tap: 'onPendingOrdersTap',
          },
        ],
        menuItems: [
          { id: 'pending', title: '待处理订单', tap: 'onPendingOrdersTap', accent: true, desc: '查看当前需要发货和换货的订单' },
          { id: 'allorders', title: '全部订单', tap: 'onAllOrdersTap', desc: '查看所有订单记录' },
          { id: 'profile', title: '个人资料', tap: 'onProfileTap', desc: '修改头像、昵称等基本信息' },
          { id: 'help', title: '帮助中心', tap: 'onHelpTap', desc: '常见问题与在线客服' },
        ],
      }
    }

    // 客户角色
    const orders = user.role === 'customer' ? await getOrders({ customerId: user.id }) : []
    const isInstitution = role === 'customer_institution' || user.customerType === 'institution'
    return {
      userRoleLabel: isInstitution ? '宠物医院客户' : '个人客户',
      avatarText: user.nickname?.[0] || '客',
      stats: [
        { label: '钱包余额', value: `¥${formatMoney(user.wallet?.balance ?? 0)}` },
        { label: '积分', value: String(user.points?.balance ?? 0) },
      ],
      statNote: '',
      compactProfile: false,
      showOrderBar: true,
      orderCounts: {
        all: orders.length,
        pendingPayment: orders.filter((o: any) => o.status === 'pending_payment').length,
        pendingReceipt: orders.filter((o: any) => o.status === 'pending_receipt').length,
        completed: orders.filter((o: any) => o.status === 'completed').length,
      },
      focusTitle: '',
      focusItems: [],
      menuItems: [
        { id: 'verify', title: '机构认证', tap: 'onVerifyTap', desc: isInstitution ? '查看认证状态与资质信息' : '提交机构资质，认证后切换为机构客户' },
        { id: 'address', title: '收货地址', tap: 'onAddressTap', desc: '管理我的收货地址' },
        { id: 'favorites', title: '收藏商品', tap: 'onFavoritesTap', desc: '我收藏的优质商品' },
        { id: 'profile', title: '个人资料', tap: 'onProfileTap', desc: '修改头像、昵称等基本信息' },
        { id: 'help', title: '帮助中心', tap: 'onHelpTap', desc: '常见问题与在线客服' },
      ],
    }
  },

  onMenuItemTap(e: any) {
    const id = e.currentTarget.dataset.id
    const item = this.data.menuItems.find((m: any) => m.id === id)
    const page = this as any
    if (item && page[item.tap]) {
      page[item.tap]()
    }
  },

  onFocusItemTap(e: any) {
    const id = e.currentTarget.dataset.id
    const item = this.data.focusItems.find((m: any) => m.id === id)
    const page = this as any
    if (item && page[item.tap]) {
      page[item.tap]()
    }
  },

  onSwitchRole() {
    const roleList = [
      { role: 'customer_institution', name: '宠物医院客户', desc: '机构价采购' },
      { role: 'customer_personal', name: '个人客户', desc: '零售购买' },
      { role: 'salesperson', name: '业务员', desc: '推广拿佣金' },
      { role: 'clerk', name: '制单员', desc: '处理订单发货' },
    ]
    wx.showActionSheet({
      itemList: roleList.map(r => `${r.name}（${r.desc}）`),
      success: async (res) => {
        const selected = roleList[res.tapIndex]
        if (selected.role === this.data.currentRole) return
        wx.showLoading({ title: '切换中...' })
        await getApp().switchDemoRole(selected.role)
        await this.loadUserInfo()
        wx.hideLoading()
        wx.showToast({ title: `已切换为${selected.name}`, icon: 'success' })
        setTimeout(() => wx.switchTab({ url: '/pages/home/home' }), 400)
      },
    })
  },

  onOrdersTap() {
    wx.navigateTo({ url: '/pages/orders/order-detail/order-detail?list=1' })
  },

  onPendingPaymentTap() {
    wx.navigateTo({ url: '/pages/orders/order-detail/order-detail?list=1&status=pending_payment' })
  },

  onPendingReceiptTap() {
    wx.navigateTo({ url: '/pages/orders/order-detail/order-detail?list=1&status=pending_receipt' })
  },

  onCompletedTap() {
    wx.navigateTo({ url: '/pages/orders/order-detail/order-detail?list=1&status=completed' })
  },

  onCatalogTap() {
    wx.switchTab({ url: '/pages/catalog/catalog' })
  },

  onAddressTap() {
    wx.navigateTo({ url: '/pages/mine/address/address' })
  },

  onVerifyTap() {
    wx.navigateTo({ url: '/pages/verify/verify' })
  },

  onCommissionTap() {
    wx.navigateTo({ url: '/pages/salesman/commission/commission' })
  },

  onPromoteTap() {
    wx.navigateTo({ url: '/pages/salesman/promote/promote' })
  },

  onPendingOrdersTap() {
    wx.navigateTo({ url: '/pages/clerk/pending/pending' })
  },

  onAllOrdersTap() {
    wx.navigateTo({ url: '/pages/clerk/orders/orders' })
  },

  onLoginTap() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  onLogout() {
    getApp().globalData.userInfo = null
    wx.removeStorageSync('current_user')
    this.setData({ userInfo: null })
  },

  onFavoritesTap() {
    wx.navigateTo({ url: '/pages/mine/favorites/favorites' })
  },

  onProfileTap() {
    wx.navigateTo({ url: '/pages/mine/profile/profile' })
  },

  onHelpTap() {
    wx.navigateTo({ url: '/pages/mine/help/help' })
  },
})

export {}
