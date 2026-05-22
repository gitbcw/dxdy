function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100
}

function canAdjustPrice(user) {
  if (!user) return false
  if (['admin', 'system_admin'].includes(user.role)) return true
  if (user.role !== 'service') return false
  return !user.permissions || user.permissions.order_price_adjust === true || user.permissions.manage_orders === true
}

function getOperatorName(user, fallback) {
  const trimmed = String(fallback || '').trim()
  return trimmed || user?.realName || user?.nickname || user?.name || user?.username || '客服'
}

function getCurrentPrice(order) {
  return order && order.pricing && typeof order.pricing.actualAmount === 'number'
    ? order.pricing.actualAmount
    : 0
}

function calculateCommission(order, newPrice, fallbackRate = 0.2) {
  const currentAmount = order?.commission && typeof order.commission.amount === 'number'
    ? order.commission.amount
    : 0
  const currentActual = getCurrentPrice(order)
  const rate = currentActual > 0 && currentAmount > 0 ? currentAmount / currentActual : fallbackRate
  return roundMoney(newPrice * rate)
}

function validatePriceAdjustment(order, newPrice) {
  if (!order) return { success: false, code: 'NOT_FOUND' }
  if (order.status !== 'pending_payment') return { success: false, code: 'INVALID_STATUS' }

  const currentPrice = getCurrentPrice(order)
  if (currentPrice <= 0) return { success: false, code: 'BAD_REQUEST' }
  if (!Number.isFinite(newPrice) || newPrice <= 0) return { success: false, code: 'BAD_REQUEST' }
  if (newPrice >= currentPrice) return { success: false, code: 'BAD_REQUEST' }

  return { success: true }
}

function buildPriceLogEntry(order, newPrice, user, operatorName, operatedAt) {
  return {
    originalPrice: getCurrentPrice(order),
    modifiedPrice: roundMoney(newPrice),
    operatorId: user._id,
    operatorName,
    operatedAt,
  }
}

function getCommissionAdjustment(previousAmount, nextAmount) {
  const diff = roundMoney(nextAmount - (previousAmount || 0))
  if (diff === 0) return null
  return {
    amount: Math.abs(diff),
    status: diff > 0 ? 'pending' : 'deducted',
    diff,
  }
}

module.exports = {
  buildPriceLogEntry,
  calculateCommission,
  canAdjustPrice,
  getCommissionAdjustment,
  getCurrentPrice,
  getOperatorName,
  roundMoney,
  validatePriceAdjustment,
}
