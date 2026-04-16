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
    const totalAmount = customers.reduce((sum: number, c: any) => sum + c.totalAmount, 0)
    this.setData({
      customers,
      totalAmount,
      totalCount: customers.length,
    })
  },
})