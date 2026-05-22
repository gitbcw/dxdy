function isOwner(order, openid) {
  if (!order || !openid) return false
  if (order.customerOpenid) return order.customerOpenid === openid
  return order._openid === openid
}

function getActualAmount(order) {
  return order && order.pricing && typeof order.pricing.actualAmount === 'number'
    ? order.pricing.actualAmount
    : 0
}

function normalizePaymentMethod(method) {
  return ['wechat', 'wallet', 'offline'].includes(method) ? method : 'wechat'
}

function getNextStatus(orderType) {
  if (orderType === 'booking') return 'pending_confirmation'
  if (orderType === 'card_order') return 'completed'
  if (orderType === 'recharge') return 'completed'
  return 'pending_shipment'
}

function shouldDeductWallet(method, orderType) {
  return method === 'wallet' && orderType !== 'recharge'
}

function canPayOrder(order, openid) {
  if (!order) return { success: false, code: 'NOT_FOUND' }
  if (!isOwner(order, openid)) return { success: false, code: 'FORBIDDEN' }
  if (order.status !== 'pending_payment') return { success: false, code: 'INVALID_STATUS' }
  if (getActualAmount(order) <= 0) return { success: false, code: 'BAD_REQUEST' }
  return { success: true }
}

function hasEnoughWalletBalance(user, amount) {
  return Boolean(user && (user.wallet?.balance || 0) >= amount)
}

function calculateRechargeCredit(order, actualAmount) {
  const tier = order?.rechargeTier || {}
  return (tier.amount || actualAmount) + (tier.bonus || 0)
}

function sumCommission(records) {
  return (records || []).reduce((sum, record) => sum + (record.amount || 0), 0)
}

module.exports = {
  calculateRechargeCredit,
  canPayOrder,
  getActualAmount,
  getNextStatus,
  hasEnoughWalletBalance,
  isOwner,
  normalizePaymentMethod,
  shouldDeductWallet,
  sumCommission,
}
