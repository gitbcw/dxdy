const { getSalesmanCustomers } = require('../../../services/index')

Page({
  data: {
    customers: [],
    totalAmount: 0,
    totalCount: 0,
  },

  onShow() {
    this.loadCustomers()
  },

  async loadCustomers() {
    const customers = await getSalesmanCustomers()
    // 处理头像首字
    const customersWithAvatar = customers.map((c: any) => ({
      ...c,
      avatarText: c.nickname.charAt(0),
    }))
    const totalAmount = customers.reduce((sum: number, c: any) => sum + c.totalAmount, 0)
    this.setData({
      customers: customersWithAvatar,
      totalAmount,
      totalCount: customers.length,
    })
  },
})