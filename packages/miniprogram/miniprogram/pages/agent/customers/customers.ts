const { getSalesmanCustomers, toggleSalesmanCustomerFocus, formatMoney } = require('../../../services/index')

Page({
  data: {
    customers: [] as any[],
    visibleCustomers: [] as any[],
    totalAmount: '0.00',
    totalCount: 0,
    summaryCards: [] as any[],
    focusCustomers: [] as any[],
    filters: [] as any[],
    activeFilter: 'all',
    focusSubmittingId: '',
  },

  onShow() {
    this.loadCustomers()
  },

  async loadCustomers() {
    const customers = await getSalesmanCustomers()
    const mappedCustomers = customers
      .map((customer: any) => ({
        ...customer,
        avatarText: (customer.nickname || customer.phone || '客').charAt(0),
        amountText: formatMoney(customer.totalAmount || 0),
        monthAmountText: formatMoney(customer.monthAmount || 0),
        priorityTag: '医院客户',
        priorityText: customer.orderCount >= 3
          ? '高活跃'
          : '医院客户',
        verificationText: customer.verificationStatus === 'approved' ? '已认证' : customer.verificationStatus === 'pending' ? '认证中' : '未认证',
        boundAtText: customer.boundAt || '未记录',
        lastOrderText: customer.lastOrderAt ? `${customer.lastOrderNo} · ${customer.lastOrderAt}` : '暂无订单',
      }))

    const focusCustomers = mappedCustomers
      .filter((customer: any) => customer.isFocused)
      .sort((a: any, b: any) => String(b.focusCreatedAt || '').localeCompare(String(a.focusCreatedAt || '')))

    const filters = [
      { key: 'all', label: '全部', count: mappedCustomers.length },
      { key: 'institution', label: '医院', count: mappedCustomers.filter((item: any) => item.type === 'institution').length },
      { key: 'active', label: '高活跃', count: mappedCustomers.filter((item: any) => item.orderCount >= 3).length },
      { key: 'afterSale', label: '售后关注', count: mappedCustomers.filter((item: any) => item.exchangeCount > 0).length },
    ]

    this.setData({
      customers: mappedCustomers,
      visibleCustomers: this.filterCustomers(mappedCustomers, this.data.activeFilter),
      totalAmount: formatMoney(mappedCustomers.reduce((sum: number, item: any) => sum + item.totalAmount, 0)),
      totalCount: mappedCustomers.length,
      summaryCards: [
        { value: String(mappedCustomers.length), label: '绑定客户', desc: '' },
        { value: `¥${formatMoney(mappedCustomers.reduce((sum: number, item: any) => sum + item.totalAmount, 0))}`, label: '累计采购', desc: '' },
        { value: String(mappedCustomers.filter((item: any) => item.exchangeCount > 0).length), label: '售后关注', desc: '' },
      ],
      focusCustomers,
      filters,
    })
  },

  filterCustomers(customers: any[], filterKey: string) {
    if (filterKey === 'institution') return customers.filter((item: any) => item.type === 'institution')
    if (filterKey === 'active') return customers.filter((item: any) => item.orderCount >= 3)
    if (filterKey === 'afterSale') return customers.filter((item: any) => item.exchangeCount > 0)
    return customers
  },

  onFilterTap(e: any) {
    const filterKey = e.currentTarget.dataset.key
    this.setData({
      activeFilter: filterKey,
      visibleCustomers: this.filterCustomers(this.data.customers, filterKey),
    })
  },

  onCustomerTap(e: any) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/agent/customer-detail/customer-detail?id=${id}` })
  },

  async onFocusToggle(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id || this.data.focusSubmittingId) return
    this.setData({ focusSubmittingId: id })
    try {
      const result = await toggleSalesmanCustomerFocus(id)
      wx.showToast({
        title: result.focused ? '已设为重点关注' : '已取消关注',
        icon: 'none',
      })
      await this.loadCustomers()
    } catch (error: any) {
      wx.showToast({ title: error?.message || '操作失败，请重试', icon: 'none' })
    } finally {
      this.setData({ focusSubmittingId: '' })
    }
  },
})

export {}
