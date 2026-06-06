function isOwner(order, openid, user) {
  if (!order) return false
  if (order.customerOpenid) return order.customerOpenid === openid
  if (order._openid) return order._openid === openid
  return Boolean(user && order.customerId && user._id && order.customerId === user._id)
}

function isStaff(user) {
  return ['admin', 'system_admin', 'service'].includes(user && user.role)
}

function canTransition(order, status, user, openid) {
  if (!order || !status) return false

  if (isOwner(order, openid, user)) {
    if (status === 'cancelled') return order.status === 'pending_payment'
    if (status === 'completed') return order.status === 'pending_receipt'
  }

  if (!isStaff(user)) return false
  const allowed = {
    pending_payment: ['cancelled'],
    pending_confirmation: ['confirmed', 'cancelled'],
    confirmed: ['cancelled'],
    pending_shipment: ['cancelled'],
    pending_receipt: ['completed'],
  }
  return (allowed[order.status] || []).includes(status)
}

function buildOrderStatusUpdate(order, status, now) {
  const updateData = { status, updatedAt: now }
  if (status === 'completed') updateData.completedAt = now
  if (status === 'completed' && order?.commission) {
    updateData['commission.status'] = 'settled'
    updateData['commission.settledAt'] = now
  }
  return updateData
}

function shouldSettleCommission(order, status) {
  return Boolean(
    status === 'completed'
    && order?.salespersonId
    && order?.commission
    && order.commission.amount > 0,
  )
}

function shouldVerifyCardVoucher(order, status) {
  return Boolean(status === 'completed' && order?.type === 'card_redemption' && order.cardVoucherId)
}

function calculateEarnedPoints(order, pointsRate = 1) {
  if (!order || order.type === 'recharge') return 0
  const amount = order.pricing && typeof order.pricing.actualAmount === 'number'
    ? order.pricing.actualAmount
    : 0
  if (amount <= 0) return 0
  return Math.floor(amount * pointsRate)
}

function shouldAwardReferral(order, completedOrderCount, customer) {
  return Boolean(
    order?.type !== 'recharge'
    && customer?.referredBy
    && completedOrderCount <= 1,
  )
}

function getOperatorName(user, fallback) {
  const trimmed = String(fallback || '').trim()
  return trimmed || user?.realName || user?.nickname || user?.name || user?.username || '用户'
}

module.exports = {
  buildOrderStatusUpdate,
  calculateEarnedPoints,
  canTransition,
  getOperatorName,
  isOwner,
  isStaff,
  shouldAwardReferral,
  shouldSettleCommission,
  shouldVerifyCardVoucher,
}
