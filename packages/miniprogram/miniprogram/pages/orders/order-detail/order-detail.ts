const {
  getOrders,
  getOrderById,
  updateOrderStatus,
  createReturn,
  getReturns,
  formatMoney,
  formatDateTime,
  getOrderStatusText,
  getOrderStatusDesc,
} = require('../../../services/index')

Page({
  data: {
    orders: [] as any[],
    visibleOrders: [] as any[],
    selectedOrder: null as any,
    selectedReturn: null as any,
    isEmpty: false,
    isDetailMode: false,
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'pending_payment', label: '待支付' },
      { key: 'pending_shipment', label: '待处理' },
      { key: 'pending_receipt', label: '配送中' },
      { key: 'completed', label: '已完成' },
    ],
    activeTab: 'all',
    summaryCards: [] as any[],
    flowSteps: [] as any[],
    detailActions: [] as any[],
  },

  onLoad(options: any) {
    if (options.id) {
      this.loadOrderDetail(options.id)
      return
    }
    this.loadOrders()
  },

  onShow() {
    if (!this.data.isDetailMode) {
      this.loadOrders()
    }
  },

  async loadOrders() {
    const user = getApp().globalData.userInfo
    if (!user) {
      this.setData({ isEmpty: true, orders: [] })
      return
    }
    const orders = await getOrders({ customerId: user.id })
    const mapped = await Promise.all(orders.map((order: any) => this.mapOrder(order)))
    this.setData({
      orders: mapped,
      visibleOrders: this.filterOrders(mapped, this.data.activeTab),
      isEmpty: mapped.length === 0,
      summaryCards: this.getSummaryCards(mapped),
      selectedOrder: null,
      selectedReturn: null,
      isDetailMode: false,
    })
  },

  async loadOrderDetail(orderId: string) {
    const order = await getOrderById(orderId)
    if (!order) {
      wx.showToast({ title: '订单不存在', icon: 'none' })
      return
    }
    const mapped = await this.mapOrder(order)
    this.setData({
      selectedOrder: mapped,
      selectedReturn: mapped.returnRecord,
      isDetailMode: true,
      flowSteps: this.getFlowSteps(mapped),
      detailActions: this.getDetailActions(mapped),
    })
  },

  async mapOrder(order: any) {
    const returns = await getReturns({ orderId: order.id })
    const returnRecord = returns[0] || null
    const firstItem = order.items?.[0] || {}
    const priceChanged = order.pricing.priceLog?.length > 0
    return {
      ...order,
      statusText: getOrderStatusText(order.status),
      statusDesc: getOrderStatusDesc(order.status),
      totalText: formatMoney(order.pricing.actualAmount),
      originalText: formatMoney(order.pricing.originalAmount),
      savedText: formatMoney(Math.max(0, order.pricing.originalAmount - order.pricing.actualAmount)),
      dateText: formatDateTime(order.createdAt),
      firstProductName: firstItem.productName,
      firstProductSpec: firstItem.spec,
      itemCount: order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      priceChanged,
      priorityLabel: priceChanged
        ? '改价待确认'
        : returnRecord
          ? '售后跟进中'
          : order.status === 'pending_payment'
            ? '优先支付'
            : order.status === 'pending_receipt'
              ? '等待收货'
              : order.type === 'booking' && order.status === 'pending_confirmation'
                ? '预约待确认'
                : '订单跟进',
      priorityNote: priceChanged
        ? `已优惠 ¥${formatMoney(Math.max(0, order.pricing.originalAmount - order.pricing.actualAmount))}`
        : returnRecord
          ? `售后：${this.getReturnStatusText(returnRecord.status)}`
          : '',
      returnRecord,
      returnStatusText: returnRecord ? this.getReturnStatusText(returnRecord.status) : '',
      commissionText: this.getCommissionText(order, returnRecord),
      logisticsText: order.shipping?.trackingNo
        ? `${order.shipping.company} ${order.shipping.trackingNo}`
        : '等待制单员录入快递单号',
    }
  },

  getSummaryCards(orders: any[]) {
    return [
      { value: String(orders.length), label: '全部订单', desc: '' },
      { value: String(orders.filter((item: any) => item.status === 'pending_payment').length), label: '待支付', desc: '' },
      { value: String(orders.filter((item: any) => item.returnRecord).length), label: '售后中', desc: '' },
    ]
  },

  getReturnStatusText(status: string) {
    const map: Record<string, string> = {
      pending_review: '售后待审核',
      approved: '审核通过',
      rejected: '审核拒绝',
      customer_shipping: '客户寄回中',
      received: '已收货验货',
      refunding: '退款处理中',
      return_completed: '退货完成',
      exchange_shipping: '换货发货中',
      exchange_completed: '换货完成',
    }
    return map[status] || status
  },

  getCommissionText(order: any, returnRecord: any) {
    if (returnRecord?.commissionAdjust?.amount) {
      const amount = returnRecord.commissionAdjust.amount
      return amount < 0 ? `售后扣减提成 ¥${formatMoney(Math.abs(amount))}` : `售后补提成 ¥${formatMoney(amount)}`
    }
    const statusMap: Record<string, string> = {
      pending: '提成待核算',
      locked: '提成锁定中',
      settled: '提成已入账',
      adjusted: '提成已调整',
      deducted: '提成已扣减',
    }
    return `${statusMap[order.commission.status] || '提成同步中'} ¥${formatMoney(order.commission.amount)}`
  },

  getFlowSteps(order: any) {
    const normalSteps = [
      { key: 'pending_payment', label: '提交订单' },
      { key: 'pending_shipment', label: '客服处理' },
      { key: 'pending_receipt', label: '制单发货' },
      { key: 'completed', label: '确认完成' },
    ]
    const bookingSteps = [
      { key: 'pending_payment', label: '提交预约' },
      { key: 'pending_confirmation', label: '客服确认' },
      { key: 'confirmed', label: '预约确认' },
      { key: 'in_service', label: '服务履约' },
      { key: 'completed', label: '完成归档' },
    ]
    const steps = order.type === 'booking' ? bookingSteps : normalSteps
    const currentIndex = Math.max(0, steps.findIndex(step => step.key === order.status))
    return steps.map((step, index) => ({
      ...step,
      active: order.status === 'completed' || index <= currentIndex,
    }))
  },

  getDetailActions(order: any) {
    const actions = []
    if (order.status === 'pending_payment') {
      actions.push({ key: 'pay', label: '模拟支付', primary: true })
      actions.push({ key: 'cancel', label: '取消订单' })
    }
    if (order.status === 'pending_receipt') {
      actions.push({ key: 'confirm', label: '确认收货', primary: true })
    }
    if (order.status === 'completed' && !order.returnRecord) {
      actions.push({ key: 'return', label: '发起退换货', primary: true })
    }
    if (order.returnRecord) {
      actions.push({ key: 'returnProgress', label: '查看售后进度', primary: true })
    }
    if (!actions.length) {
      actions.push({ key: 'timeline', label: '查看流程说明', primary: true })
    }
    return actions
  },

  onTabTap(e: any) {
    const activeTab = e.currentTarget.dataset.key
    this.setData({
      activeTab,
      visibleOrders: this.filterOrders(this.data.orders, activeTab),
      isEmpty: this.filterOrders(this.data.orders, activeTab).length === 0,
    })
  },

  filterOrders(list: any[], tab: string) {
    if (tab === 'all') return list
    return list.filter((order: any) => {
      if (tab === 'pending_shipment') {
        return order.status === 'pending_shipment' || order.status === 'pending_confirmation'
      }
      return order.status === tab
    })
  },

  onOrderTap(e: any) {
    const id = e.currentTarget.dataset.id
    this.loadOrderDetail(id)
  },

  onBackToList() {
    this.loadOrders()
  },

  async onActionTap(e: any) {
    const key = e.currentTarget.dataset.key
    const order = this.data.selectedOrder
    if (!order) return

    if (key === 'pay') {
      const nextStatus = order.type === 'booking' ? 'pending_confirmation' : 'pending_shipment'
      await updateOrderStatus(order.id, nextStatus)
      wx.showToast({ title: order.type === 'booking' ? '预约待客服确认' : '支付成功', icon: 'success' })
      this.loadOrderDetail(order.id)
      return
    }

    if (key === 'cancel') {
      await updateOrderStatus(order.id, 'cancelled')
      wx.showToast({ title: '订单已取消', icon: 'success' })
      this.loadOrderDetail(order.id)
      return
    }

    if (key === 'confirm') {
      await updateOrderStatus(order.id, 'completed')
      wx.showToast({ title: '已确认收货', icon: 'success' })
      this.loadOrderDetail(order.id)
      return
    }

    if (key === 'return') {
      const firstItem = order.items[0]
      await createReturn({
        orderId: order.id,
        type: 'exchange',
        reason: '规格调整，申请换货',
        items: [{
          productId: firstItem.productId,
          productName: firstItem.productName,
          quantity: 1,
          unitPrice: firstItem.unitPrice,
        }],
      })
      wx.showToast({ title: '售后申请已提交', icon: 'success' })
      this.loadOrderDetail(order.id)
      return
    }

    if (key === 'returnProgress') {
      wx.showModal({
        title: '售后进度',
        content: `${order.returnStatusText}\n${order.commissionText}`,
        showCancel: false,
      })
      return
    }

    wx.showModal({
      title: '流程说明',
      content: order.statusDesc,
      showCancel: false,
    })
  },
})

export {}
