const { getSalesmanCustomers, formatMoney } = require('../../../services/index')

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
  },

  onShow() {
    this.loadCustomers()
  },

  async loadCustomers() {
    const customers = await getSalesmanCustomers()
    const sortedCustomers = customers
      .map((customer: any) => ({
        ...customer,
        avatarText: (customer.nickname || customer.phone || '客').charAt(0),
        amountText: formatMoney(customer.totalAmount || 0),
        monthAmountText: formatMoney(customer.monthAmount || 0),
        priorityTag: customer.type === 'institution' ? '机构客户' : '普通客户',
        priorityText: customer.orderCount >= 3
          ? '高活跃'
          : customer.type === 'institution'
            ? '机构客户'
            : '新客户',
        verificationText: customer.verificationStatus === 'approved' ? '已认证' : customer.verificationStatus === 'pending' ? '认证中' : '未认证',
        boundAtText: customer.boundAt || '未记录',
        lastOrderText: customer.lastOrderAt ? `${customer.lastOrderNo} · ${customer.lastOrderAt}` : '暂无订单',
      }))
      .sort((a: any, b: any) => (b.totalAmount || 0) - (a.totalAmount || 0))

    const filters = [
      { key: 'all', label: '全部', count: sortedCustomers.length },
      { key: 'institution', label: '医院', count: sortedCustomers.filter((item: any) => item.type === 'institution').length },
      { key: 'personal', label: '个人', count: sortedCustomers.filter((item: any) => item.type !== 'institution').length },
      { key: 'active', label: '高活跃', count: sortedCustomers.filter((item: any) => item.orderCount >= 3).length },
      { key: 'afterSale', label: '售后关注', count: sortedCustomers.filter((item: any) => item.exchangeCount > 0).length },
    ]

    this.setData({
      customers: sortedCustomers,
      visibleCustomers: this.filterCustomers(sortedCustomers, this.data.activeFilter),
      totalAmount: formatMoney(sortedCustomers.reduce((sum: number, item: any) => sum + item.totalAmount, 0)),
      totalCount: sortedCustomers.length,
      summaryCards: [
        { value: String(sortedCustomers.length), label: '绑定客户', desc: '' },
        { value: `¥${formatMoney(sortedCustomers.reduce((sum: number, item: any) => sum + item.totalAmount, 0))}`, label: '累计采购', desc: '' },
        { value: String(sortedCustomers.filter((item: any) => item.exchangeCount > 0).length), label: '售后关注', desc: '' },
      ],
      focusCustomers: sortedCustomers.slice(0, 3),
      filters,
    })
  },

  filterCustomers(customers: any[], filterKey: string) {
    if (filterKey === 'institution') return customers.filter((item: any) => item.type === 'institution')
    if (filterKey === 'personal') return customers.filter((item: any) => item.type !== 'institution')
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
})

export {}
