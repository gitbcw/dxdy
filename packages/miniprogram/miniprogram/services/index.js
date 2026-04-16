/**
 * 小程序端服务桥接
 * 直接引用 shared/lib 的 mock 服务
 */
const shared = require('../shared/lib/index')

// 重新导出所有服务
const services = {
  loginByPhone: shared.loginByPhone,
  registerCustomer: shared.registerCustomer,
  getCurrentUser: shared.getCurrentUser,
  logout: shared.logout,
  getProducts: shared.getProducts,
  getProductById: shared.getProductById,
  getCategories: shared.getCategories,
  getOrders: shared.getOrders,
  getOrderById: shared.getOrderById,
  createOrder: shared.createOrder,
  adjustOrderPrice: shared.adjustOrderPrice,
  updateOrderStatus: shared.updateOrderStatus,
  cancelOrder: shared.cancelOrder,
  shipOrder: shared.shipOrder,
  confirmBooking: shared.confirmBooking,
  getReturns: shared.getReturns,
  getReturnById: shared.getReturnById,
  createReturn: shared.createReturn,
  reviewReturn: shared.reviewReturn,
  getCommissionRecords: shared.getCommissionRecords,
  getWithdrawalRecords: shared.getWithdrawalRecords,
  requestWithdrawal: shared.requestWithdrawal,
  getClerkOrders: shared.getClerkOrders,
  getClerkOrderById: shared.getClerkOrderById,
  clerkShipOrder: shared.clerkShipOrder,
  getSalesmanCustomers: shared.getSalesmanCustomers,
  getCommissionSummary: shared.getCommissionSummary,
  requestWithdrawalByAmount: shared.requestWithdrawalByAmount,
  getCustomerById: shared.getCustomerById,
  getSalespersonById: shared.getSalespersonById,
  bindSalesperson: shared.bindSalesperson,
  submitVerification: shared.submitVerification,
  saveAddress: shared.saveAddress,
  deleteAddress: shared.deleteAddress,
  getSystemConfig: shared.getSystemConfig,
  getUserNotifications: shared.getUserNotifications,
  markNotificationRead: shared.markNotificationRead,
  getUnreadCount: shared.getUnreadCount,
  formatMoney: shared.formatMoney,
  formatDate: shared.formatDate,
  formatDateTime: shared.formatDateTime,
  maskPhone: shared.maskPhone,
}

module.exports = services
