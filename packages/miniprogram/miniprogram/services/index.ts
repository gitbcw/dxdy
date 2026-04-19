/**
 * 小程序端服务桥接
 * 直接引用 shared/lib 的 mock 服务，用 wx.setStorageSync 做本地持久化
 */
const shared = require('../shared/lib/index')

// 重新导出所有服务
export const {
  loginByPhone,
  registerCustomer,
  getCurrentUser,
  logout,
  getProducts,
  getProductById,
  getCategories,
  getOrders,
  getOrderById,
  createOrder,
  adjustOrderPrice,
  updateOrderStatus,
  cancelOrder,
  shipOrder,
  confirmBooking,
  getClerkOrders,
  getClerkOrderById,
  clerkShipOrder,
  getReturns,
  getReturnById,
  createReturn,
  reviewReturn,
  getCommissionRecords,
  getWithdrawalRecords,
  requestWithdrawal,
  getCustomerById,
  getSalespersonById,
  bindSalesperson,
  submitVerification,
  saveAddress,
  deleteAddress,
  getSystemConfig,
  getUserNotifications,
  markNotificationRead,
  getUnreadCount,
  formatMoney,
  formatDate,
  formatDateTime,
  maskPhone,
} = shared
