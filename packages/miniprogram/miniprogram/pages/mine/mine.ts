const {
  formatMoney,
  getOrders,
  getClerkOrders,
  getCommissionSummary,
} = require('../../services/index')
const { normalizePath } = require('../../utils/tab-bar')
const icons = require('../../services/icons')
const tracking = require('../../services/tracking')

function withMenuIcons(items: any[]) {
  return items.map((item) => ({
    ...item,
    iconSrc: icons.iconByKey[item.iconKey || item.id] || icons.order,
  }))
}

function getDisplayOrderNo(order: any) {
  return order?.orderNo || order?.id || '未编号订单'
}

Page({
  data: {
    loadingUser: true,
    userInfo: null as any,
    currentRole: 'customer_personal',
    userRoleLabel: '普通客户',
    avatarText: '客',
    stats: [] as any[],
    statNote: '',
    compactProfile: false,
    showVerifyState: true,
    showOrderBar: false,
    orderCounts: { all: 0, pendingPayment: 0, pendingReceipt: 0, completed: 0 },
    focusTitle: '',
    focusItems: [] as any[],
    menuItems: [] as any[],
    orderIconAll: icons.allOrders,
    orderIconPayment: icons.payment,
    orderIconReceipt: icons.receipt,
    orderIconCompleted: icons.completed,
    certIcon: icons.hospital,
  },

  onShow() {
    this.syncTabBar()
    tracking.trackPageView('mine')
    this.loadUserInfo()
  },

  syncTabBar() {
    const tabBar = (this as any).getTabBar?.()
    tabBar?.updateForPage?.(normalizePath('/pages/mine/mine'))
  },

  async loadUserInfo() {
    const app = getApp()
    app.restoreCachedUser?.()
    const user = app.globalData.userInfo
    const userRole = app.globalData.userRole as string || 'customer_personal'

    if (!user) {
      this.setData({ loadingUser: false, userInfo: null, menuItems: [], focusItems: [], showOrderBar: false, compactProfile: false, statNote: '' })
      return
    }

    const roleData = await this.getRoleCopy(userRole, user)
    this.setData({
      loadingUser: false,
      userInfo: user,
      currentRole: userRole,
      ...roleData,
      menuItems: withMenuIcons(roleData.menuItems || []),
    })
  },

  async getRoleCopy(role: string, user: any) {
    if (role === 'salesperson') {
      const summary = await getCommissionSummary()
      const agentStatus = user.agentStatus || 'approved'
      return {
        userRoleLabel: '代理商',
        avatarText: user.nickname?.[0] || '代',
        stats: [
          { label: '累计提成', value: `¥${formatMoney(summary.total)}` },
          { label: '可提现', value: `¥${formatMoney(summary.available)}` },
        ],
        statNote: `待抵扣 ¥${formatMoney(summary.pendingDeduction)}`,
        compactProfile: true,
        showVerifyState: false,
        showOrderBar: false,
        orderCounts: { all: 0, pendingPayment: 0, pendingReceipt: 0, completed: 0 },
        focusTitle: '',
        focusItems: [],
        menuItems: [
          { id: 'agentStatus', title: '代理商状态', tap: 'onAgentStatusTap', accent: agentStatus !== 'approved', desc: agentStatus === 'approved' ? '合作资格已开通' : '查看申请审核进度' },
          { id: 'withdraw', title: '提现与银行卡', tap: 'onWithdrawTap', desc: '管理银行卡和提现记录' },
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
        showVerifyState: false,
        showOrderBar: false,
        orderCounts: { all: 0, pendingPayment: 0, pendingReceipt: 0, completed: 0 },
        focusTitle: '当前待处理',
        focusItems: [
          {
            id: 'pending-summary',
            badge: exchangeCount > 0 ? '含换货单' : '待发货',
            title: pending.length > 0 ? `${pending.length} 单待处理` : '暂无待处理订单',
            desc: pending.length > 0
              ? '普通发货与换货发货统一从待处理订单进入'
              : '当前没有待处理发货任务',
            meta: pending[0]
              ? `最近订单：${getDisplayOrderNo(pending[0])} · ${pending[0].customerName || '客户'}`
              : '进入待处理订单查看后续任务',
            tap: 'onPendingOrdersTap',
          },
        ],
        menuItems: [
          { id: 'allorders', title: '全部订单', tap: 'onAllOrdersTap', desc: '查看所有订单记录' },
          { id: 'profile', title: '个人资料', tap: 'onProfileTap', desc: '修改头像、昵称等基本信息' },
          { id: 'help', title: '帮助中心', tap: 'onHelpTap', desc: '常见问题与在线客服' },
        ],
      }
    }

    const orders = user.role === 'customer' ? await getOrders({ customerId: user.id }) : []
    const isInstitution = role === 'customer_institution' || user.customerType === 'institution'
    const customerMenuItems = [
      { id: 'address', icon: '址', title: '收货地址', tap: 'onAddressTap', desc: '管理配送地址与医院名称' },
      { id: 'wallet', icon: '余', title: '钱包与积分', tap: 'onWalletTap', desc: '充值余额，查看积分和优惠' },
      { id: 'invoice', icon: '票', title: '发票申请', tap: 'onInvoiceTap', desc: '电子发票与纸质发票' },
      { id: 'service', icon: '客', title: '售后与客服', tap: 'onHelpTap', desc: '订单、物流、售后咨询' },
    ]

    return {
      userRoleLabel: isInstitution ? '宠物医院客户' : '普通客户',
      avatarText: user.nickname?.[0] || '客',
      stats: [
        { label: '钱包余额', value: `¥${formatMoney(user.wallet?.balance ?? 0)}` },
        { label: '积分', value: String(user.points?.balance ?? 0) },
      ],
      statNote: '',
      compactProfile: false,
      showVerifyState: true,
      showOrderBar: true,
      orderCounts: {
        all: orders.length,
        pendingPayment: orders.filter((o: any) => o.status === 'pending_payment').length,
        pendingReceipt: orders.filter((o: any) => o.status === 'pending_receipt').length,
        completed: orders.filter((o: any) => o.status === 'completed').length,
      },
      focusTitle: '',
      focusItems: [],
      menuItems: customerMenuItems,
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
    wx.showToast({ title: '角色由账号类型决定', icon: 'none' })
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

  onInvoiceTap() {
    wx.navigateTo({ url: '/pages/invoice/apply/apply' })
  },

  onTestQueryTap() {
    wx.navigateTo({ url: '/pages/tests/query/query' })
  },

  onReturnDetailTap() {
    wx.navigateTo({ url: '/pages/returns/detail/detail' })
  },

  onCatalogTap() {
    wx.switchTab({ url: '/pages/catalog/catalog' })
  },

  onAddressTap() {
    wx.navigateTo({ url: '/pages/mine/address/address' })
  },

  onCouponsTap() {
    wx.navigateTo({ url: '/pages/coupons/coupons' })
  },

  onPointsTap() {
    wx.navigateTo({ url: '/pages/points/history/history' })
  },

  onWalletTap() {
    wx.navigateTo({ url: '/pages/wallet/recharge/recharge' })
  },

  onReferralTap() {
    wx.navigateTo({ url: '/pages/referral/share/share' })
  },

  onVerifyTap() {
    wx.navigateTo({ url: '/pages/verify/verify' })
  },

  onCommissionTap() {
    wx.navigateTo({ url: '/pages/agent/commission/commission' })
  },

  onPromoteTap() {
    wx.navigateTo({ url: '/pages/agent/promote/promote' })
  },

  onCustomersTap() {
    wx.navigateTo({ url: '/pages/agent/customers/customers' })
  },

  onWithdrawTap() {
    wx.navigateTo({ url: '/pages/agent/withdraw/withdraw' })
  },

  onAgentOrdersTap() {
    wx.navigateTo({ url: '/pages/agent/orders/orders' })
  },

  onAgentApplyTap() {
    wx.navigateTo({ url: '/pages/agent/apply/apply' })
  },

  onAgentStatusTap() {
    wx.navigateTo({ url: '/pages/agent/verify-status/verify-status' })
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
    this.setData({ loadingUser: true })
    getApp().globalData.userInfo = null
    getApp().globalData.userRole = ''
    wx.removeStorageSync('current_user')
    wx.removeStorageSync('user_role')
    wx.reLaunch({ url: '/pages/login/login' })
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
