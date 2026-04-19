/**
 * 小程序端服务桥接
 * 优先请求本地演示 API，失败时回退到 shared/lib 的 mock 服务
 */
const shared = require('../shared/lib/index')
const API_BASE = 'http://192.168.1.120:3100/api/demo'

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}${path}`,
      method: options.method || 'GET',
      data: options.data,
      timeout: options.timeout || 3000,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data?.data)
          return
        }
        reject(new Error(res.data?.error || `request failed: ${res.statusCode}`))
      },
      fail: reject,
    })
  })
}

async function withFallback(remoteCall, fallbackCall) {
  try {
    return await remoteCall()
  } catch (error) {
    console.warn('[demo-api] fallback to local mock service:', error?.message || error)
    return fallbackCall()
  }
}

function toQuery(params = {}) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  return query ? `?${query}` : ''
}

// 重新导出所有服务
const services = {
  loginByPhone: shared.loginByPhone,
  registerCustomer: shared.registerCustomer,
  getCurrentUser: shared.getCurrentUser,
  logout: shared.logout,
  getProducts: shared.getProducts,
  getProductById: shared.getProductById,
  getCategories: shared.getCategories,
  getOrders: (params) => withFallback(
    () => request(`/orders${toQuery(params)}`),
    () => shared.getOrders(params),
  ),
  getOrderById: (id) => withFallback(
    () => request(`/orders/${id}`),
    () => shared.getOrderById(id),
  ),
  createOrder: shared.createOrder,
  adjustOrderPrice: shared.adjustOrderPrice,
  updateOrderStatus: (orderId, status) => withFallback(
    () => request(`/orders/${orderId}`, { method: 'POST', data: { status } }),
    () => shared.updateOrderStatus(orderId, status),
  ),
  cancelOrder: shared.cancelOrder,
  shipOrder: shared.shipOrder,
  confirmBooking: shared.confirmBooking,
  getReturns: (params) => withFallback(
    () => request(`/returns${toQuery(params)}`),
    () => shared.getReturns(params),
  ),
  getReturnById: shared.getReturnById,
  createReturn: (params) => withFallback(
    () => request('/returns', { method: 'POST', data: params }),
    () => shared.createReturn(params),
  ),
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
