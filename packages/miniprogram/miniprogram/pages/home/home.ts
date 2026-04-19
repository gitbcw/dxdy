const {
  getProducts,
  getOrders,
  getReturns,
  getClerkOrders,
  formatMoney,
} = require('../../services/index')

type DemoRole = 'customer_personal' | 'customer_institution' | 'salesperson' | 'clerk'

Page({
  data: {
    roleLabel: '个人客户',
    heroSubtitle: '从宠物药品采购、宠物血液预约到发货售后，给老板看一条完整业务闭环。',
    primaryActionText: '进入宠物药品采购',
    avatarText: '客',
    displayName: '未登录客户',
    identityDesc: '登录后可演示不同身份看到的商品、价格和订单流程',
    verificationText: '演示模式',
    verificationClass: 'demo',
    flowSteps: [] as any[],
    stats: [] as any[],
    scenarios: [] as any[],
    featuredProducts: [] as any[],
    currentRole: 'customer_personal' as DemoRole,
  },

  onShow() {
    this.loadDemoHome()
  },

  async loadDemoHome() {
    const app = getApp()
    const user = app.globalData.userInfo
    const currentRole = (app.globalData.userRole || this.inferRole(user)) as DemoRole
    const isInstitution = currentRole === 'customer_institution' || user?.customerType === 'institution'
    const visibility = isInstitution ? 'institution' : 'personal'
    const [products, customerOrders, allReturns, clerkPending] = await Promise.all([
      getProducts({ visibility }),
      user?.role === 'customer' ? getOrders({ customerId: user.id }) : Promise.resolve([]),
      getReturns(),
      getClerkOrders ? getClerkOrders({ status: 'pending' }) : Promise.resolve([]),
    ])

    const featuredProducts = products.slice(0, 5).map((product: any) => ({
      id: product.id,
      name: product.name,
      spec: product.specs?.[0]?.value || '标准规格',
      price: formatMoney(isInstitution ? product.institutionPrice : (product.personalPrice || product.institutionPrice)),
      stock: product.stock,
      badge: product.visibility === 'institution_only' ? '机构专属' : product.isBloodPack ? '用血预约' : '热销',
    }))

    const pendingOrders = customerOrders.filter((order: any) => order.status !== 'completed' && order.status !== 'cancelled')
    const identity = this.getIdentityCopy(currentRole, user)

    this.setData({
      currentRole,
      ...identity,
      flowSteps: [
        { label: '注册绑定', active: true },
        { label: '分层选品', active: true },
        { label: '下单预约', active: customerOrders.length > 0 },
        { label: '客服处理', active: pendingOrders.length > 0 },
        { label: '制单发货', active: clerkPending.length > 0 },
        { label: '售后提成', active: allReturns.length > 0 },
      ],
      stats: this.getStats(currentRole, {
        products,
        customerOrders,
        allReturns,
        clerkPending,
      }),
      scenarios: this.getScenarios(currentRole),
      featuredProducts,
    })
  },

  inferRole(user: any): DemoRole {
    if (user?.role === 'salesperson') return 'salesperson'
    if (user?.role === 'clerk') return 'clerk'
    if (user?.customerType === 'institution') return 'customer_institution'
    return 'customer_personal'
  },

  getIdentityCopy(role: DemoRole, user: any) {
    const name = user?.nickname || '未登录客户'
    if (role === 'customer_institution') {
      const status = user?.verificationStatus || 'approved'
      const textMap: Record<string, string> = {
        approved: '机构认证已通过',
        pending: '机构认证待审核',
        rejected: '认证被驳回',
        none: '待提交机构认证',
      }
      return {
        roleLabel: '宠物医院',
        heroSubtitle: '宠物医院可查看机构价、批量采购价和宠物血液制品预约入口。',
        primaryActionText: '预约宠物用血',
        avatarText: (name[0] || '医'),
        displayName: name,
        identityDesc: '宠物医院账号 · 机构价 · 专属血液制品可见',
        verificationText: textMap[status] || '机构认证已通过',
        verificationClass: status === 'approved' ? 'approved' : 'pending',
      }
    }

    if (role === 'salesperson') {
      return {
        roleLabel: '业务员',
        heroSubtitle: '业务员可推广宠物医院客户，查看绑定客户、订单贡献和提成调整。',
        primaryActionText: '打开推广二维码',
        avatarText: (name[0] || '业'),
        displayName: name,
        identityDesc: '业务员工作台 · 推广绑定永久有效 · 提成自动核算',
        verificationText: '业务员已认证',
        verificationClass: 'approved',
      }
    }

    if (role === 'clerk') {
      return {
        roleLabel: '制单员',
        heroSubtitle: '制单员接收客服指派订单，录入快递单号后同步客户物流。',
        primaryActionText: '处理待发货订单',
        avatarText: (name[0] || '制'),
        displayName: name,
        identityDesc: '制单员工作台 · 普通订单和换货订单统一处理',
        verificationText: '待办同步中',
        verificationClass: 'approved',
      }
    }

    return {
      roleLabel: '个人客户',
      heroSubtitle: '个人客户可购买宠物保健品、预约基础检测服务，无需机构认证。',
      primaryActionText: '购买宠物保健品',
      avatarText: (name[0] || '客'),
      displayName: name,
      identityDesc: '个人宠物客户 · 注册即用 · 钱包积分可展示',
      verificationText: '无需机构认证',
      verificationClass: 'demo',
    }
  },

  getStats(role: DemoRole, data: any) {
    if (role === 'salesperson') {
      return [
        { value: '8', label: '绑定客户', desc: '宠物医院为主' },
        { value: '¥3,200', label: '可提现', desc: '含售后扣减' },
        { value: String(data.allReturns.length), label: '售后影响', desc: '自动影响提成' },
      ]
    }
    if (role === 'clerk') {
      return [
        { value: String(data.clerkPending.length), label: '待处理', desc: '含换货任务' },
        { value: '6', label: '快递公司', desc: '支持录入单号' },
        { value: '实时', label: '物流同步', desc: '客户可查进度' },
      ]
    }
    return [
      { value: String(data.products.length), label: '可见商品', desc: '按身份过滤' },
      { value: String(data.customerOrders.length), label: '我的订单', desc: '展示闭环状态' },
      { value: String(data.allReturns.length), label: '售后记录', desc: '退款/换货进度' },
    ]
  },

  getScenarios(role: DemoRole) {
    if (role === 'salesperson') {
      return [
        { icon: '📣', title: '推广获客', desc: '生成专属二维码，客户首次注册永久绑定业务员。', cta: '去推广', action: 'promote', tone: 'teal' },
        { icon: '🏥', title: '客户经营', desc: '查看宠物医院下单次数、累计采购和退换货记录。', cta: '看客户', action: 'customers', tone: 'white' },
        { icon: '¥', title: '提成核算', desc: '收货后进入锁定期，退换货自动扣减或补提成。', cta: '看提成', action: 'commission', tone: 'amber' },
      ]
    }
    if (role === 'clerk') {
      return [
        { icon: '📦', title: '待处理订单', desc: '接收客服指派，区分普通发货与换货发货。', cta: '去处理', action: 'clerkPending', tone: 'teal' },
        { icon: '🚚', title: '录入快递', desc: '选择快递公司，录入单号后同步客户订单物流。', cta: '看订单', action: 'clerkOrders', tone: 'white' },
        { icon: '🔁', title: '换货履约', desc: '换货任务关联原订单，方便客服和客户追踪。', cta: '看换货', action: 'clerkOrders', tone: 'amber' },
      ]
    }
    return [
      { icon: '💊', title: '宠物药品采购', desc: '保健品和处方类商品按客户身份展示不同价格。', cta: '去采购', action: 'catalog', tone: 'teal' },
      { icon: '🩸', title: '宠物用血预约', desc: '机构客户认证后可查看犬猫血液制品并发起预约。', cta: '去预约', action: 'blood', tone: 'white' },
      { icon: '🔁', title: '售后与提成闭环', desc: '退货、换货、退款和业务员提成调整自动联动。', cta: '看订单', action: 'orders', tone: 'amber' },
    ]
  },

  onPrimaryAction() {
    const role = this.data.currentRole
    if (role === 'salesperson') {
      wx.navigateTo({ url: '/pages/salesman/promote/promote' })
      return
    }
    if (role === 'clerk') {
      wx.navigateTo({ url: '/pages/clerk/pending/pending' })
      return
    }
    wx.switchTab({ url: '/pages/catalog/catalog' })
  },

  onScenarioTap(e: any) {
    const action = e.currentTarget.dataset.action
    const routes: Record<string, string> = {
      promote: '/pages/salesman/promote/promote',
      customers: '/pages/salesman/customers/customers',
      commission: '/pages/salesman/commission/commission',
      clerkPending: '/pages/clerk/pending/pending',
      clerkOrders: '/pages/clerk/orders/orders',
      orders: '/pages/orders/order-detail/order-detail?list=1',
    }
    if (action === 'catalog' || action === 'blood') {
      wx.switchTab({ url: '/pages/catalog/catalog' })
      return
    }
    wx.navigateTo({ url: routes[action] || '/pages/orders/order-detail/order-detail?list=1' })
  },

  onProductTap(e: any) {
    wx.navigateTo({ url: `/pages/orders/create/create?productId=${e.currentTarget.dataset.id}` })
  },

  onCatalogTap() {
    wx.switchTab({ url: '/pages/catalog/catalog' })
  },

  onOrdersTap() {
    wx.navigateTo({ url: '/pages/orders/order-detail/order-detail?list=1' })
  },

  onMineTap() {
    wx.switchTab({ url: '/pages/mine/mine' })
  },

  onSwitchRole() {
    this.onMineTap()
  },

  async onRoleCardTap(e: any) {
    const role = e.currentTarget.dataset.role as DemoRole
    const app = getApp()
    if (app.switchDemoRole) {
      await app.switchDemoRole(role)
      wx.showToast({ title: '身份已切换', icon: 'success' })
      await this.loadDemoHome()
      return
    }
    wx.switchTab({ url: '/pages/mine/mine' })
  },
})

export {}
