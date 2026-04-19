const {
  formatMoney,
  getOrders,
  getClerkOrders,
  getCommissionSummary,
  getSalesmanCustomers,
} = require('../../services/index')

Page({
  data: {
    userInfo: null as any,
    balance: '0.00',
    points: 0,
    currentRole: 'customer_personal',
    userRoleLabel: '个人客户',
    roleDesc: '个人宠物客户 · 注册即用',
    pageHeadline: '这里放你的账户和常用入口',
    pageSubhead: '不同身份会看到不同的工作台重点。',
    avatarText: '客',
    stats: [] as any[],
    focusTitle: '今天要处理',
    focusItems: [] as any[],
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
      this.setData({ userInfo: null, menuItems: [], focusItems: [] })
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
      const [summary, customers] = await Promise.all([
        getCommissionSummary(),
        getSalesmanCustomers(),
      ])
      const recentCustomers = customers.slice(0, 3)
      return {
        userRoleLabel: '业务员',
        roleDesc: '推广绑定客户 · 订单提成自动核算',
        pageHeadline: '这不是资料页，而是你的成交工作台',
        pageSubhead: '先看可提现佣金、再看最值得跟进的客户和推广入口。',
        avatarText: user.nickname?.[0] || '业',
        stats: [
          { label: '累计提成', value: `¥${formatMoney(summary.total)}`, desc: '历史累计收益' },
          { label: '可提现', value: `¥${formatMoney(summary.available)}`, desc: '已经可以申请提现' },
          { label: '待抵扣', value: `¥${formatMoney(summary.pendingDeduction)}`, desc: '售后会自动影响' },
        ],
        focusTitle: '今天优先跟进',
        focusItems: recentCustomers.map((customer: any) => ({
          id: customer.id,
          badge: customer.type === 'institution' ? '机构客户' : '个人客户',
          title: customer.nickname,
          desc: `已下单 ${customer.orderCount} 次，售后 ${customer.exchangeCount} 次`,
          meta: `累计采购 ¥${formatMoney(customer.totalAmount)}`,
          tap: 'onCustomersTap',
        })),
        menuItems: [
          { id: 'promote', title: '推广工具', desc: '生成专属二维码，客户首次注册永久绑定', tap: 'onPromoteTap', accent: true },
          { id: 'customers', title: '客户管理', desc: '查看宠物医院下单与售后记录', tap: 'onCustomersTap' },
          { id: 'commission', title: '我的佣金', desc: '提成锁定、提现、退换货扣减', tap: 'onCommissionTap' },
          { id: 'switch', title: '工作身份', desc: '切换客户、业务员、制单员工作台', tap: 'onSwitchRole' },
        ],
      }
    }

    if (role === 'clerk') {
      const [pending, shipped] = await Promise.all([
        getClerkOrders({ status: 'pending' }),
        getClerkOrders({ status: 'shipped' }),
      ])
      return {
        userRoleLabel: '制单员',
        roleDesc: '接收指派订单 · 录入物流单号',
        pageHeadline: '这里先看今天要发什么',
        pageSubhead: '把待发货、换货单和物流同步放在最前面，减少无效跳转。',
        avatarText: user.nickname?.[0] || '制',
        stats: [
          { label: '待处理', value: String(pending.length), desc: '普通单和换货单' },
          { label: '已发货', value: String(shipped.length), desc: '今天已录入物流' },
          { label: '同步状态', value: '实时', desc: '客户可在订单中心查看' },
        ],
        focusTitle: '现在最急的单',
        focusItems: pending.slice(0, 3).map((order: any) => ({
          id: order.id,
          badge: order.type === 'exchange' ? '换货单' : '普通单',
          title: order.orderNo,
          desc: `${order.customerName} · ${order.items[0]?.name || '订单商品'}`,
          meta: order.address,
          tap: 'onPendingOrdersTap',
        })),
        menuItems: [
          { id: 'pending', title: '待处理订单', desc: '录入快递公司和单号', tap: 'onPendingOrdersTap', accent: true },
          { id: 'allorders', title: '全部订单', desc: '查看已发货和换货任务', tap: 'onAllOrdersTap' },
          { id: 'switch', title: '工作身份', desc: '切换客户、业务员、制单员工作台', tap: 'onSwitchRole' },
        ],
      }
    }

    const orders = user.role === 'customer' ? await getOrders({ customerId: user.id }) : []
    const isInstitution = role === 'customer_institution' || user.customerType === 'institution'
    const pendingPayment = orders.find((order: any) => order.status === 'pending_payment')
    const shippingOrder = orders.find((order: any) => order.status === 'pending_receipt')
    return {
      userRoleLabel: isInstitution ? '宠物医院客户' : '个人客户',
      roleDesc: isInstitution ? '机构价 · 宠物血液制品可见 · 采购闭环' : '保健品零售 · 检测预约 · 钱包积分',
      pageHeadline: isInstitution ? '这里更像采购工作台，不只是个人资料' : '这里统一放账户、订单和常用入口',
      pageSubhead: isInstitution
        ? '先看待付款和待收货订单，再去机构采购和预约服务。'
        : '先看钱包、积分和订单入口，把常用操作收在一起。',
      avatarText: user.nickname?.[0] || '客',
      stats: [
        { label: '钱包余额', value: `¥${formatMoney(user.wallet?.balance ?? 0)}`, desc: '可用于支付' },
        { label: '积分', value: String(user.points?.balance ?? 0), desc: '消费累积' },
        { label: '订单', value: String(orders.length), desc: '全流程追踪' },
      ],
      focusTitle: isInstitution ? '当前最该处理' : '最近常用',
      focusItems: [
        {
          id: 'orders',
          badge: pendingPayment ? '待付款' : '订单中心',
          title: pendingPayment ? `${pendingPayment.id} 等待支付` : '查看全部订单',
          desc: pendingPayment ? `${pendingPayment.items.length} 件商品待完成支付` : '支付、发货、售后统一追踪',
          meta: pendingPayment ? `应付 ¥${formatMoney(pendingPayment.pricing.actualAmount)}` : '进入订单中心查看',
          tap: 'onOrdersTap',
        },
        {
          id: 'catalog',
          badge: isInstitution ? '机构采购' : '立即购买',
          title: isInstitution ? '进入机构价专区' : '进入商品采购页',
          desc: isInstitution ? '查看机构价商品和血液制品入口' : '个人客户可直接购买保健品和常规商品',
          meta: isInstitution ? '机构认证通过后能力开放' : '从首页或这里都能直接去买',
          tap: 'onCatalogTap',
        },
        {
          id: 'shipping',
          badge: shippingOrder ? '待收货' : '地址说明',
          title: shippingOrder ? `${shippingOrder.id} 正在配送` : '收货地址在下单页直接选择',
          desc: shippingOrder ? '物流和售后进度都会在订单里更新' : '不用单独维护复杂资料页',
          meta: shippingOrder ? '查看物流详情' : '下单流程更顺手',
          tap: shippingOrder ? 'onOrdersTap' : 'onAddressTap',
        },
      ],
      menuItems: [
        { id: 'orders', title: '我的订单', desc: '查看支付、发货、售后与提成影响', tap: 'onOrdersTap', accent: true },
        { id: 'catalog', title: isInstitution ? '机构采购' : '宠物保健采购', desc: '按身份展示不同商品和价格', tap: 'onCatalogTap' },
        { id: 'address', title: '收货地址', desc: '下单时从已有地址中选择', tap: 'onAddressTap' },
        { id: 'switch', title: '工作身份', desc: '切换客户、业务员、制单员工作台', tap: 'onSwitchRole' },
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

  onCatalogTap() {
    wx.switchTab({ url: '/pages/catalog/catalog' })
  },

  onAddressTap() {
    wx.showToast({ title: '下单时可直接选择已有地址', icon: 'none' })
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
