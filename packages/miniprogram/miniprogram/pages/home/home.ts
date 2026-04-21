const {
  getProducts,
  getOrders,
  getReturns,
  getClerkOrders,
  getCommissionSummary,
  formatMoney,
  addToCart,
  getOrderStatusText,
} = require('../../services/index')
const { normalizePath } = require('../../utils/tab-bar')

type DemoRole = 'customer_personal' | 'customer_institution' | 'salesperson' | 'clerk'

type HomeAction =
  | 'catalog'
  | 'blood'
  | 'orders'
  | 'promote'
  | 'commission'
  | 'clerkPending'
  | 'clerkOrders'
  | 'verify'

function toProductBoardItem(product: any) {
  return {
    id: product.id,
    type: 'product',
    badge: product.isBloodPack ? '服务商品' : '热销',
    title: product.name,
    desc: product.specs?.[0]?.value || '标准规格',
    meta: `¥${formatMoney(product.personalPrice || product.institutionPrice || 0)} · 库存 ${product.stock}`,
    institutionPrice: product.institutionPrice,
    personalPrice: product.personalPrice,
  }
}

Page({
  data: {
    displayName: '未登录客户',
    identityTag: '普通客户',
    identityTagClass: 'default',
    searchPlaceholder: '搜索商品',
    searchKeyword: '',
    banner: null as any,
    taskCards: [] as any[],
    quickActions: [] as any[],
    boardTitle: '商品推荐',
    boardMoreText: '查看全部',
    boardItems: [] as any[],
    currentRole: 'customer_personal' as DemoRole,
    isInstitution: false,
    actionSheetVisible: false,
    actionSheetProduct: {} as any,
  },

  _rawProducts: [] as any[],

  onShow() {
    this.syncTabBar()
    this.loadDemoHome()
  },

  syncTabBar() {
    const tabBar = (this as any).getTabBar?.()
    tabBar?.updateForPage?.(normalizePath('/pages/home/home'))
  },

  async loadDemoHome() {
    const app = getApp()
    const user = app.globalData.userInfo
    const currentRole = (app.globalData.userRole || this.inferRole(user)) as DemoRole
    const isInstitution = currentRole === 'customer_institution' || user?.customerType === 'institution'
    const visibility = isInstitution ? 'institution' : 'personal'

    const [products, customerOrders, allReturns, clerkPending, clerkShipped, commission] = await Promise.all([
      getProducts({ visibility }),
      user?.role === 'customer' ? getOrders({ customerId: user.id }) : Promise.resolve([]),
      getReturns(),
      getClerkOrders ? getClerkOrders({ status: 'pending' }) : Promise.resolve([]),
      getClerkOrders ? getClerkOrders({ status: 'shipped' }) : Promise.resolve([]),
      getCommissionSummary ? getCommissionSummary() : Promise.resolve(null),
    ])

    const pendingOrders = customerOrders.filter((order: any) => !['completed', 'cancelled'].includes(order.status))
    this._rawProducts = products
    const dashboard = this.getDashboard(currentRole, {
      user,
      products,
      customerOrders,
      pendingOrders,
      allReturns,
      clerkPending,
      clerkShipped,
      commission,
    })

    this.setData({ currentRole, isInstitution, banner: null, ...dashboard })
  },

  inferRole(user: any): DemoRole {
    if (user?.role === 'salesperson') return 'salesperson'
    if (user?.role === 'clerk') return 'clerk'
    if (user?.customerType === 'institution') return 'customer_institution'
    return 'customer_personal'
  },

  getDashboard(role: DemoRole, data: any) {
    const name = data.user?.nickname || '未登录客户'

    // ── 机构客户 ──────────────────────────
    if (role === 'customer_institution') {
      const isVerified = data.user?.verificationStatus === 'approved'

      // 未认证 → 普通体验 + 认证横幅
      if (!isVerified) {
        const bannerStatus = data.user?.verificationStatus || 'none'
        const bannerTextMap: Record<string, string> = {
          none: '完成医院认证，解锁机构专属商品与价格',
          pending: '认证审核中，请耐心等待',
          rejected: '认证被驳回，请重新提交',
        }

        return {
          displayName: name,
          identityTag: '普通客户',
          identityTagClass: 'default',
          banner: {
            status: bannerStatus,
            text: bannerTextMap[bannerStatus] || bannerTextMap.none,
            actionText: bannerStatus === 'pending' ? '' : bannerStatus === 'rejected' ? '重新提交' : '去认证',
            rejectReason: data.user?.verificationInfo?.rejectReason || '',
          },
          taskCards: data.pendingOrders.length > 0 ? [{
            badge: '订单',
            title: `订单号：${data.pendingOrders[0].id}`,
            desc: `当前状态：${getOrderStatusText(data.pendingOrders[0].status)}`,
            meta: '',
            action: 'orders',
            actionText: '看订单',
          }] : [],
          quickActions: [
            { icon: '览', title: '浏览商品', action: 'catalog' },
            { icon: '单', title: '我的订单', action: 'orders' },
            { icon: '证', title: '去认证', action: 'verify' },
          ],
          boardTitle: '商品推荐',
          boardMoreText: '查看全部',
          boardItems: data.products.slice(0, 3).map(toProductBoardItem),
        }
      }

      // 已认证 → 完整机构体验
      const pendingPayment = data.customerOrders.find((order: any) => order.status === 'pending_payment')
      const shippingOrder = data.customerOrders.find((order: any) => order.status === 'pending_receipt')
      const institutionProducts = data.products
        .filter((product: any) => !product.isBloodPack)
        .slice(0, 3)
        .map((product: any) => ({
          ...toProductBoardItem(product),
          badge: product.visibility === 'institution_only' ? '机构价' : '常购',
          meta: `¥${formatMoney(product.institutionPrice || product.personalPrice || 0)} · 库存 ${product.stock}`,
        }))

      const taskCards: any[] = []
      if (pendingPayment) {
        taskCards.push({
          badge: '付款',
          title: `${pendingPayment.id} 待付款`,
          desc: `${pendingPayment.items.length} 件商品`,
          meta: `应付 ¥${formatMoney(pendingPayment.pricing.actualAmount)}`,
          action: 'orders',
          actionText: '去支付',
        })
      }
      if (shippingOrder) {
        taskCards.push({
          badge: '收货',
          title: `${shippingOrder.id} 待收货`,
          desc: '查看物流状态',
          meta: '',
          action: 'orders',
          actionText: '看进度',
        })
      }

      return {
        displayName: name,
        identityTag: '认证机构',
        identityTagClass: 'verified',
        taskCards,
        quickActions: [
          { icon: '购', title: '商品采购', action: 'catalog' },
          { icon: '血', title: '预约用血', action: 'blood' },
          { icon: '单', title: '我的订单', action: 'orders' },
        ],
        boardTitle: '常购商品',
        boardMoreText: '进入采购',
        boardItems: institutionProducts,
      }
    }

    // ── 业务员 ──────────────────────────
    if (role === 'salesperson') {
      return {
        displayName: name,
        identityTag: '业务员',
        identityTagClass: 'staff',
        taskCards: [
          {
            badge: '推广',
            title: '推广小程序',
            desc: '通过专属二维码邀请客户注册',
            meta: '',
            action: 'promote',
            actionText: '看二维码',
          },
          {
            badge: '收益',
            title: '佣金概览',
            desc: '',
            meta: `累计佣金 ¥${formatMoney(data.commission?.total || 0)}`,
            action: 'commission',
            actionText: '看佣金',
          },
        ],
        quickActions: [
          { icon: '佣', title: '我的佣金', action: 'commission' },
          { icon: '推', title: '推广工具', action: 'promote' },
        ],
        boardTitle: '',
        boardMoreText: '',
        boardItems: [],
      }
    }

    // ── 制单员 ──────────────────────────
    if (role === 'clerk') {
      const urgentOrders = data.clerkPending.slice(0, 3)
      return {
        displayName: name,
        identityTag: '制单员',
        identityTagClass: 'staff',
        taskCards: [
          {
            badge: '优先',
            title: urgentOrders[0] ? `${urgentOrders[0].orderNo} 等待发货` : '暂无待发货任务',
            desc: urgentOrders[0] ? `${urgentOrders[0].customerName} · ${urgentOrders[0].items[0]?.name || '订单商品'}` : '',
            meta: urgentOrders[0] ? `${urgentOrders[0].type === 'exchange' ? '换货单' : '普通单'} · ${urgentOrders[0].address}` : '',
            action: 'clerkPending',
            actionText: '去处理',
          },
          {
            badge: '换货',
            title: data.clerkPending.some((item: any) => item.type === 'exchange') ? '有换货单待处理' : '暂无换货单',
            desc: '',
            meta: '',
            action: 'clerkPending',
            actionText: '看任务',
          },
        ],
        quickActions: [
          { icon: '发', title: '待处理', action: 'clerkPending' },
          { icon: '运', title: '全部订单', action: 'clerkOrders' },
        ],
        boardTitle: '当前发货队列',
        boardMoreText: '全部订单',
        boardItems: urgentOrders.map((order: any) => ({
          id: order.id,
          type: 'action',
          badge: order.type === 'exchange' ? '换货单' : '普通单',
          title: order.orderNo,
          desc: `${order.customerName} · ${order.items[0]?.name || '订单商品'}`,
          meta: order.address,
          action: 'clerkPending',
          actionText: '去发货',
        })),
      }
    }

    // ── 个人客户 ──────────────────────────
    return {
      displayName: name,
      identityTag: '普通客户',
      identityTagClass: 'default',
      banner: {
        status: 'none',
        text: '完成机构认证后可切换为机构客户，解锁机构专属商品与价格',
        actionText: '去认证',
        rejectReason: '',
      },
      taskCards: data.pendingOrders.length > 0 ? [{
        badge: '订单',
        title: `订单号：${data.pendingOrders[0].id}`,
        desc: `当前状态：${getOrderStatusText(data.pendingOrders[0].status)}`,
        meta: '',
        action: 'orders',
        actionText: '看订单',
      }] : [],
      quickActions: [
        { icon: '购', title: '商品浏览', action: 'catalog' },
        { icon: '单', title: '我的订单', action: 'orders' },
      ],
      boardTitle: '热销推荐',
      boardMoreText: '查看全部',
      boardItems: data.products.slice(0, 3).map(toProductBoardItem),
    }
  },

  handleAction(action: HomeAction) {
    const routes: Record<string, string> = {
      blood: '/pages/blood/booking/booking',
      promote: '/pages/salesman/promote/promote',
      commission: '/pages/salesman/commission/commission',
      clerkPending: '/pages/clerk/pending/pending',
      clerkOrders: '/pages/clerk/orders/orders',
      orders: '/pages/orders/order-detail/order-detail?list=1',
    }

    if (action === 'catalog') {
      wx.switchTab({ url: '/pages/catalog/catalog' })
      return
    }

    if (action === 'verify') {
      wx.navigateTo({ url: '/pages/verify/verify' })
      return
    }

    wx.navigateTo({ url: routes[action] || '/pages/orders/order-detail/order-detail?list=1' })
  },

  onSearchTap() {
    this.submitSearch()
  },

  onSearchInput(e: any) {
    this.setData({ searchKeyword: e.detail.value || '' })
  },

  onSearchClear() {
    this.setData({ searchKeyword: '' })
  },

  onSearchConfirm() {
    this.submitSearch()
  },

  submitSearch() {
    const keyword = (this.data.searchKeyword || '').trim()
    if (keyword) {
      const app = getApp()
      app.globalData.catalogSearchKeyword = keyword
      wx.setStorageSync('catalog_search_keyword', keyword)
      wx.switchTab({ url: '/pages/catalog/catalog' })
      return
    }
    wx.switchTab({ url: '/pages/catalog/catalog' })
  },

  onBannerAction() {
    wx.navigateTo({ url: '/pages/verify/verify' })
  },

  onTaskTap(e: any) {
    this.handleAction(e.currentTarget.dataset.action)
  },

  onQuickActionTap(e: any) {
    this.handleAction(e.currentTarget.dataset.action)
  },

  onBoardItemTap(e: any) {
    const idx = e.currentTarget.dataset.idx
    const item = this.data.boardItems[idx]
    if (!item) return

    if (item.type === 'product') {
      wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${item.id}` })
    } else if (item.action) {
      this.handleAction(item.action)
    }
  },

  onBoardCartTap(e: any) {
    const idx = e.currentTarget.dataset.idx
    const item = this.data.boardItems[idx]
    if (!item) return

    const rawProduct = this._rawProducts.find((p: any) => p.id === item.id)
    if (!rawProduct) return

    this.setData({
      actionSheetVisible: true,
      actionSheetProduct: { ...rawProduct },
    })
  },

  onActionSheetClose() {
    this.setData({ actionSheetVisible: false })
  },

  onActionSheetAddCart(e: any) {
    const { product, quantity } = e.detail
    addToCart(product, quantity)
    this.setData({ actionSheetVisible: false })
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  onActionSheetBuyNow(e: any) {
    const { product } = e.detail
    this.setData({ actionSheetVisible: false })
    wx.navigateTo({ url: `/pages/orders/create/create?productId=${product.id}` })
  },

  onBoardMoreTap() {
    const role = this.data.currentRole
    if (role === 'clerk') {
      this.handleAction('clerkOrders')
      return
    }
    this.handleAction('catalog')
  },
})

export {}
