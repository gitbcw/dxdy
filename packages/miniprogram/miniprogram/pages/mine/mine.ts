const { formatMoney, getOrders, getClerkOrders, getCommissionSummary } = require('../../services/index')

Page({
  data: {
    userInfo: null as any,
    balance: '0.00',
    points: 0,
    currentRole: 'customer_personal',
    userRoleLabel: '个人客户',
    roleDesc: '个人宠物客户 · 注册即用',
    avatarText: '客',
    stats: [] as any[],
    menuItems: [] as any[],
  },

  onShow() {
    this.loadUserInfo()
  },

  async loadUserInfo() {
    const app = getApp()
    const user = app.globalData.userInfo
    const userRole = app.globalData.userRole as string || 'customer_personal'

    if (!user) {
      this.setData({ userInfo: null, menuItems: [] })
      return
    }

    const roleCopy = await this.getRoleCopy(userRole, user)
    this.setData({
      userInfo: user,
      balance: formatMoney(user.wallet?.balance ?? 0),
      points: user.points?.balance ?? 0,
      currentRole: userRole,
      ...roleCopy,
    })
  },

  async getRoleCopy(role: string, user: any) {
    if (role === 'salesperson') {
      const summary = await getCommissionSummary()
      return {
        userRoleLabel: '业务员',
        roleDesc: '推广绑定客户 · 订单提成自动核算',
        avatarText: user.nickname?.[0] || '业',
        stats: [
          { label: '累计提成', value: `¥${formatMoney(summary.total)}`, desc: '历史累计' },
          { label: '可提现', value: `¥${formatMoney(summary.available)}`, desc: '可申请提现' },
          { label: '待抵扣', value: `¥${formatMoney(summary.pendingDeduction)}`, desc: '售后影响' },
        ],
        menuItems: [
          { id: 'promote', title: '推广工具', desc: '生成专属二维码，客户首次注册永久绑定', tap: 'onPromoteTap', accent: true },
          { id: 'customers', title: '客户管理', desc: '查看宠物医院下单与售后记录', tap: 'onCustomersTap' },
          { id: 'commission', title: '我的佣金', desc: '提成锁定、提现、退换货扣减', tap: 'onCommissionTap' },
          { id: 'switch', title: '切换演示身份', desc: '切换客户/业务员/制单员视角', tap: 'onSwitchRole' },
        ],
      }
    }

    if (role === 'clerk') {
      const pending = await getClerkOrders({ status: 'pending' })
      const shipped = await getClerkOrders({ status: 'shipped' })
      return {
        userRoleLabel: '制单员',
        roleDesc: '接收指派订单 · 录入物流单号',
        avatarText: user.nickname?.[0] || '制',
        stats: [
          { label: '待处理', value: String(pending.length), desc: '普通/换货' },
          { label: '已发货', value: String(shipped.length), desc: '已录入物流' },
          { label: '同步', value: '实时', desc: '客户可查' },
        ],
        menuItems: [
          { id: 'pending', title: '待处理订单', desc: '录入快递公司和单号', tap: 'onPendingOrdersTap', accent: true },
          { id: 'allorders', title: '全部订单', desc: '查看已发货和换货任务', tap: 'onAllOrdersTap' },
          { id: 'switch', title: '切换演示身份', desc: '切换客户/业务员/制单员视角', tap: 'onSwitchRole' },
        ],
      }
    }

    const orders = user.role === 'customer' ? await getOrders({ customerId: user.id }) : []
    const isInstitution = role === 'customer_institution' || user.customerType === 'institution'
    return {
      userRoleLabel: isInstitution ? '宠物医院客户' : '个人客户',
      roleDesc: isInstitution ? '机构价 · 宠物血液制品可见 · 采购闭环' : '保健品零售 · 检测预约 · 钱包积分',
      avatarText: user.nickname?.[0] || '客',
      stats: [
        { label: '钱包余额', value: `¥${formatMoney(user.wallet?.balance ?? 0)}`, desc: '可用于支付' },
        { label: '积分', value: String(user.points?.balance ?? 0), desc: '消费累积' },
        { label: '订单', value: String(orders.length), desc: '全流程追踪' },
      ],
      menuItems: [
        { id: 'orders', title: '我的订单', desc: '查看支付、发货、售后与提成影响', tap: 'onOrdersTap', accent: true },
        { id: 'catalog', title: isInstitution ? '机构采购' : '宠物保健采购', desc: '按身份展示不同商品和价格', tap: 'onCatalogTap' },
        { id: 'address', title: '收货地址', desc: '演示默认履约地址', tap: 'onAddressTap' },
        { id: 'switch', title: '切换演示身份', desc: '切换客户/业务员/制单员视角', tap: 'onSwitchRole' },
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

  onCatalogTap() {
    wx.switchTab({ url: '/pages/catalog/catalog' })
  },

  onAddressTap() {
    wx.showToast({ title: '默认地址已用于演示订单', icon: 'none' })
  },

  onCommissionTap() {
    wx.navigateTo({ url: '/pages/salesman/commission/commission' })
  },

  onCustomersTap() {
    wx.navigateTo({ url: '/pages/salesman/customers/customers' })
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
})

export {}
