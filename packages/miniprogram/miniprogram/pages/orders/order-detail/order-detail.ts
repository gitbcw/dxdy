const {
  getOrders,
  getOrderById,
  deleteOrder,
  updateOrderStatus,
  payOrder,
  getMyCards,
  getReturns,
  getSystemConfig,
  formatMoney,
  formatDateTime,
  getOrderStatusText,
  getOrderStatusDesc,
  getProductVisualImage,
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
      { key: 'cancelled', label: '已取消' },
    ],
    activeTab: 'all',
    summaryCards: [] as any[],
    flowSteps: [] as any[],
    detailActions: [] as any[],
    queryCustomerId: '',
    selectedPayMethod: 'wechat',
    walletBalanceText: '0.00',
    availableCardVouchers: [] as any[],
    selectedCardVoucherId: '',
    selectedCardVoucher: null as any,
    cardDiscountText: '0.00',
    payableAmountText: '0.00',
    paymentTimeoutMinutes: 30,
  },

  _paymentTimer: 0 as any,
  _autoCancelling: {} as Record<string, boolean>,

  onLoad(options: any) {
    if (options.customerId) {
      this.setData({ queryCustomerId: options.customerId })
    }
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
    this.startPaymentCountdown()
  },

  onHide() {
    this.stopPaymentCountdown()
  },

  onUnload() {
    this.stopPaymentCountdown()
  },

  async loadOrders() {
    const user = getApp().globalData.userInfo
    if (!user) {
      this.setData({ isEmpty: true, orders: [] })
      return
    }
    await this.ensureSystemConfig()
    const orders = await getOrders({ customerId: this.data.queryCustomerId || user.id })
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
    this.startPaymentCountdown()
  },

  async loadOrderDetail(orderId: string) {
    await this.ensureSystemConfig()
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
      selectedPayMethod: mapped.payment?.method === 'wallet' ? 'wallet' : 'wechat',
      walletBalanceText: formatMoney(getApp().globalData.userInfo?.wallet?.balance || 0),
      availableCardVouchers: [],
      selectedCardVoucherId: '',
      selectedCardVoucher: null,
      cardDiscountText: '0.00',
      payableAmountText: mapped.totalText,
    })
    this.loadCardVouchersForOrder(mapped)
    this.startPaymentCountdown()
  },

  async loadCardVouchersForOrder(order: any) {
    if (!order || order.type !== 'booking' || order.status !== 'pending_payment') return
    try {
      const cards = await getMyCards()
      const available = (cards || [])
        .filter((card: any) => card.status === 'claimed')
        .map((card: any) => {
          const discountAmount = Number(card.deductionAmount || card.discountAmount || card.amount || 0)
          return {
            ...card,
            discountAmount,
            discountText: formatMoney(discountAmount),
          }
        })
        .filter((card: any) => card.discountAmount > 0)
      this.setData({ availableCardVouchers: available })
      this.refreshPayablePreview()
    } catch (_e) {
      this.setData({ availableCardVouchers: [] })
    }
  },

  async mapOrder(order: any) {
    const returns = await getReturns({ orderId: order.id })
    const returnRecord = returns[0] || null
    const firstItem = order.items?.[0] || {}
    const priceChanged = order.pricing.priceLog?.length > 0
    const paymentTimeout = this.getPaymentTimeoutInfo(order)
    const canQueryLogistics = this.canQueryLogistics(order)
    return {
      ...order,
      canQueryLogistics,
      statusText: getOrderStatusText(order.status),
      statusDesc: getOrderStatusDesc(order.status),
      totalText: formatMoney(order.pricing.actualAmount),
      originalText: formatMoney(order.pricing.originalAmount),
      savedText: formatMoney(Math.max(0, order.pricing.originalAmount - order.pricing.actualAmount)),
      dateText: formatDateTime(order.createdAt),
      paymentTimeout,
      paymentMethodText: this.getPaymentMethodText(order.payment?.method),
      firstProductName: firstItem.productName,
      firstProductSpec: firstItem.spec,
      firstProductImage: firstItem.productImage || getProductVisualImage(firstItem.productName),
      items: (order.items || []).map((item: any) => ({
        ...item,
        productImage: item.productImage || getProductVisualImage(item.productName),
      })),
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
      canDelete: order.status === 'completed' || order.status === 'cancelled',
      commissionText: this.getCommissionText(order, returnRecord),
      logisticsText: order.shipping?.deliveryMode === 'direct' || order.shipping?.directDelivery?.status === 'departed'
        ? `制单员已出发，预计 ${order.shipping?.directDelivery?.estimatedArrivalAt || order.shipping?.eta || '待更新'} 到达`
        : order.shipping?.deliveryMode === 'sf_pickup' || order.shipping?.wxExpress
          ? '顺丰散单上门揽收，暂不支持在线查询'
        : order.shipping?.trackingNo
          ? `${order.shipping.company} ${order.shipping.trackingNo}`
          : '等待制单员录入快递单号',
    }
  },

  canQueryLogistics(order: any) {
    const shipping = order?.shipping || {}
    if (shipping.deliveryMode === 'direct' || shipping.directDelivery?.status === 'departed') return true
    if (shipping.deliveryMode === 'sf_pickup' || shipping.wxExpress) return false
    return !!shipping.trackingNo
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

  async ensureSystemConfig() {
    try {
      const config = await getSystemConfig()
      this.setData({ paymentTimeoutMinutes: Number(config?.paymentTimeoutMinutes || 30) })
    } catch (_e) {
      this.setData({ paymentTimeoutMinutes: 30 })
    }
  },

  parseDate(value: any) {
    if (!value) return null
    if (value instanceof Date) return value
    const text = String(value).trim()
    if (!text) return null
    const utcLike = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/)
    if (utcLike) {
      return new Date(Date.UTC(
        Number(utcLike[1]),
        Number(utcLike[2]) - 1,
        Number(utcLike[3]),
        Number(utcLike[4]),
        Number(utcLike[5]),
        Number(utcLike[6] || 0),
      ))
    }
    const date = new Date(text.includes('T') ? text : text.replace(' ', 'T'))
    if (!Number.isNaN(date.getTime())) return date
    const fallback = new Date(text.replace(/-/g, '/'))
    return Number.isNaN(fallback.getTime()) ? null : fallback
  },

  getPaymentTimeoutInfo(order: any) {
    if (!order || order.status !== 'pending_payment') return null
    const minutes = Number(this.data.paymentTimeoutMinutes || 30)
    if (!minutes) {
      return {
        enabled: false,
        deadlineText: '',
        notice: '当前订单未开启自动取消，请尽快完成支付',
      }
    }
    const baseTime = this.parseDate(order.pendingPaymentAt || order.confirmedAt || order.createdAt)
    if (!baseTime) return null
    const deadline = new Date(baseTime.getTime() + minutes * 60 * 1000)
    const remainingSeconds = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / 1000))
    const expired = remainingSeconds <= 0
    const countdownText = this.formatCountdown(remainingSeconds)
    return {
      enabled: true,
      deadlineText: formatDateTime(deadline),
      remainingSeconds,
      countdownText,
      expired,
      notice: expired
        ? '订单已超过支付期限，系统将自动取消'
        : `剩余支付时间 ${countdownText}，超时订单将自动取消`,
    }
  },

  formatCountdown(totalSeconds: number) {
    const seconds = Math.max(0, Number(totalSeconds || 0))
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    const mm = String(m).padStart(2, '0')
    const ss = String(s).padStart(2, '0')
    if (h > 0) return `${h}:${mm}:${ss}`
    return `${mm}:${ss}`
  },

  startPaymentCountdown() {
    this.stopPaymentCountdown()
    const hasPending = this.hasPendingPaymentOrders()
    if (!hasPending) return
    this._paymentTimer = setInterval(() => {
      this.tickPaymentCountdown()
    }, 1000)
  },

  stopPaymentCountdown() {
    if (this._paymentTimer) {
      clearInterval(this._paymentTimer)
      this._paymentTimer = 0
    }
  },

  hasPendingPaymentOrders() {
    if (this.data.selectedOrder?.status === 'pending_payment') return true
    return (this.data.orders || []).some((order: any) => order.status === 'pending_payment')
  },

  tickPaymentCountdown() {
    const mapOrderCountdown = (order: any) => {
      if (!order || order.status !== 'pending_payment') return order
      const paymentTimeout = this.getPaymentTimeoutInfo(order)
      return { ...order, paymentTimeout }
    }
    const orders = (this.data.orders || []).map(mapOrderCountdown)
    const selectedOrder = this.data.selectedOrder ? mapOrderCountdown(this.data.selectedOrder) : null
    this.setData({
      orders,
      visibleOrders: this.filterOrders(orders, this.data.activeTab),
      selectedOrder,
    })

    const expiredOrders = [
      ...orders.filter((order: any) => order.status === 'pending_payment' && order.paymentTimeout?.remainingSeconds <= 0),
      ...(selectedOrder?.status === 'pending_payment' && selectedOrder.paymentTimeout?.remainingSeconds <= 0 ? [selectedOrder] : []),
    ]
    expiredOrders.forEach((order: any) => this.autoCancelTimeoutOrder(order))
    if (!this.hasPendingPaymentOrders()) this.stopPaymentCountdown()
  },

  async autoCancelTimeoutOrder(order: any) {
    const orderId = order?.id
    if (!orderId || this._autoCancelling[orderId]) return
    this._autoCancelling[orderId] = true
    try {
      await updateOrderStatus(orderId, 'cancelled')
      const nextOrder = {
        ...order,
        status: 'cancelled',
        statusText: getOrderStatusText('cancelled'),
        statusDesc: getOrderStatusDesc('cancelled'),
        paymentTimeout: null,
        canDelete: true,
      }
      const orders = (this.data.orders || []).map((item: any) => item.id === orderId ? nextOrder : item)
      this.setData({
        orders,
        visibleOrders: this.filterOrders(orders, this.data.activeTab),
        selectedOrder: this.data.selectedOrder?.id === orderId ? nextOrder : this.data.selectedOrder,
        summaryCards: this.getSummaryCards(orders),
      })
      wx.showToast({ title: '订单已超时取消', icon: 'none' })
    } catch (_e) {
      this.loadOrders()
    } finally {
      delete this._autoCancelling[orderId]
    }
  },

  getPaymentMethodText(method: string) {
    const map: Record<string, string> = {
      wechat: '微信支付',
      wallet: '钱包余额',
      offline: '线下支付',
      card_voucher: '卡券支付',
    }
    return map[method] || (method ? method : '未支付')
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
      { key: 'pending_receipt', label: '制单配送' },
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
      actions.push({ key: 'pay', label: '去支付', primary: true })
      actions.push({ key: 'cancel', label: '取消订单' })
    }
    if (order.status === 'pending_receipt') {
      actions.push({ key: 'confirm', label: '确认收货', primary: true })
      if (this.canQueryLogistics(order)) {
        actions.push({ key: 'logistics', label: '查看物流' })
      }
    }
    if (order.status === 'completed' && !order.returnRecord) {
      actions.push({ key: 'return', label: '发起退换货', primary: true })
      actions.push({ key: 'review', label: '评价订单', primary: false })
    }
    if (order.returnRecord) {
      actions.push({ key: 'returnProgress', label: '查看售后进度', primary: true })
    }
    if (order.status === 'completed' || order.status === 'cancelled') {
      actions.push({ key: 'delete', label: '删除订单', danger: true })
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

  onInvoiceTap() {
    const order = this.data.selectedOrder
    if (!order) return
    wx.navigateTo({ url: `/pages/invoice/apply/apply?orderId=${order.id}` })
  },

  onLogisticsTap() {
    const order = this.data.selectedOrder
    if (!order) return
    if (!order.canQueryLogistics) {
      wx.showToast({ title: '顺丰散单暂不支持在线查询', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/logistics/detail/detail?orderId=${order.id}` })
  },

  onLogisticsFromList(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const order = (this.data.visibleOrders || []).find((item: any) => item.id === id)
    if (order && !order.canQueryLogistics) {
      wx.showToast({ title: '顺丰散单暂不支持在线查询', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/logistics/detail/detail?orderId=${id}` })
  },

  onTestReportTap() {
    wx.navigateTo({ url: '/pages/tests/query/query' })
  },

  onReturnEntryTap() {
    const order = this.data.selectedOrder
    if (!order) return
    if (order.returnRecord) {
      wx.navigateTo({ url: `/pages/returns/detail/detail?orderId=${order.id}` })
      return
    }
    wx.navigateTo({ url: `/pages/returns/apply/apply?orderId=${order.id}` })
  },

  onReturnFromList(e: any) {
    const orderId = e.currentTarget.dataset.id
    if (!orderId) return
    wx.navigateTo({ url: `/pages/returns/apply/apply?orderId=${orderId}` })
  },

  onServiceTap() {
    wx.makePhoneCall({ phoneNumber: '02022043433' })
  },

  onPayMethodTap(e: any) {
    const method = e.currentTarget.dataset.method || 'wechat'
    this.setData({ selectedPayMethod: method })
  },

  onCardVoucherTap(e: any) {
    const id = e.currentTarget.dataset.id || ''
    const nextId = this.data.selectedCardVoucherId === id ? '' : id
    const selectedCardVoucher = nextId
      ? this.data.availableCardVouchers.find((card: any) => card.id === nextId) || null
      : null
    const total = Number(this.data.selectedOrder?.pricing?.actualAmount || 0)
    const discount = Math.min(total, Number(selectedCardVoucher?.discountAmount || 0))
    const payable = Math.max(0, Math.round((total - discount) * 100) / 100)
    this.setData({
      selectedCardVoucherId: nextId,
      selectedCardVoucher,
      cardDiscountText: formatMoney(discount),
      payableAmountText: formatMoney(payable),
    })
  },

  refreshPayablePreview() {
    const order = this.data.selectedOrder
    if (!order) return
    const total = Number(order.pricing?.actualAmount || 0)
    const discount = Math.min(total, Number(this.data.selectedCardVoucher?.discountAmount || 0))
    const payable = Math.max(0, Math.round((total - discount) * 100) / 100)
    this.setData({
      cardDiscountText: formatMoney(discount),
      payableAmountText: formatMoney(payable),
    })
  },

  async waitForPaymentResult(orderId: string) {
    for (let i = 0; i < 6; i += 1) {
      const latest = await getOrderById(orderId)
      if (latest?.payment?.status === 'paid' || latest?.status !== 'pending_payment') return latest
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    return null
  },

  onDeleteFromList(e: any) {
    const orderId = e.currentTarget.dataset.id
    if (!orderId) return
    this.confirmDeleteOrder(orderId)
  },

  confirmDeleteOrder(orderId: string) {
    wx.showModal({
      title: '删除订单',
      content: '删除后该订单将不再显示，是否继续？',
      confirmText: '删除',
      confirmColor: '#e5484d',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await deleteOrder(orderId)
          wx.showToast({ title: '已删除', icon: 'success' })
          if (this.data.isDetailMode) {
            this.loadOrders()
            return
          }
          const orders = this.data.orders.filter((item: any) => item.id !== orderId)
          const visibleOrders = this.filterOrders(orders, this.data.activeTab)
          this.setData({
            orders,
            visibleOrders,
            isEmpty: visibleOrders.length === 0,
            summaryCards: this.getSummaryCards(orders),
          })
        } catch (err: any) {
          wx.showToast({ title: err?.message || '删除失败', icon: 'none' })
        }
      },
    })
  },

  async onActionTap(e: any) {
    const key = e.currentTarget.dataset.key
    const order = this.data.selectedOrder
    if (!order) return

    if (key === 'pay') {
      const method = this.data.selectedPayMethod || 'wechat'
      const cardVoucherId = this.data.selectedCardVoucherId || ''
      wx.showLoading({ title: method === 'wechat' ? '正在拉起支付' : '正在支付', mask: true })
      try {
        const result = await payOrder(order.id, method, cardVoucherId ? { cardVoucherId } : undefined)
        wx.hideLoading()

        if (!result.success) {
          wx.showToast({ title: result.error || '支付失败', icon: 'none' })
          return
        }

        if (method === 'wechat') {
          if (!result.payment && result.order?.payment?.status !== 'paid') {
            wx.showToast({ title: '微信支付参数缺失', icon: 'none' })
            return
          }
          if (result.payment) {
            await new Promise<void>((resolve, reject) => {
              wx.requestPayment({
                ...result.payment,
                success: () => resolve(),
                fail: (err: WechatMiniprogram.GeneralCallbackResult) => reject(err),
              })
            })
            wx.showLoading({ title: '确认支付结果', mask: true })
            await this.waitForPaymentResult(order.id)
            wx.hideLoading()
          }
        }

        wx.redirectTo({ url: `/pages/orders/pay-result/pay-result?id=${order.id}` })
      } catch (err: any) {
        wx.hideLoading()
        const message = String(err?.errMsg || err?.message || '')
        wx.showToast({
          title: message.includes('cancel') ? '已取消支付' : '支付失败，请重试',
          icon: 'none',
        })
      }
      return
    }

    try {
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

      if (key === 'delete') {
        this.confirmDeleteOrder(order.id)
        return
      }
    } catch (e: any) {
      wx.showToast({ title: e?.message || '操作失败', icon: 'none' })
      return
    }

    if (key === 'logistics') {
      if (!order.canQueryLogistics) {
        wx.showToast({ title: '顺丰散单暂不支持在线查询', icon: 'none' })
        return
      }
      wx.navigateTo({ url: `/pages/logistics/detail/detail?orderId=${order.id}` })
      return
    }

    if (key === 'return') {
      wx.navigateTo({ url: `/pages/returns/apply/apply?orderId=${order.id}` })
      return
    }

    if (key === 'returnProgress') {
      wx.navigateTo({ url: `/pages/returns/detail/detail?orderId=${order.id}` })
      return
    }

    if (key === 'review') {
      const item = order.items?.[0]
      if (item) {
        wx.navigateTo({ url: `/pages/reviews/submit/submit?orderId=${order.id}&productId=${item.productId}` })
      }
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
