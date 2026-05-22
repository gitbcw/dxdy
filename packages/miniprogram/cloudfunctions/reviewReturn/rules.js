function canonicalStatus(status) {
  const map = {
    pending_return_ship: 'customer_shipping',
    returned: 'received',
    verifying: 'received',
  }
  return map[status] || status
}

function getTargetStatus(event) {
  if (event.status) return canonicalStatus(String(event.status).trim())
  if (typeof event.approved === 'boolean') return event.approved ? 'approved' : 'rejected'
  return ''
}

function canReview(user) {
  if (!user) return false
  if (['admin', 'system_admin'].includes(user.role)) return true
  if (user.role !== 'service') return false
  return !user.permissions || user.permissions.return_review === true || user.permissions.manage_returns === true
}

function getAllowedStatuses(record) {
  const current = canonicalStatus(record.status)
  const base = {
    pending_review: ['approved', 'rejected'],
    approved: record.type === 'refund_only' ? ['refunding'] : ['customer_shipping', 'refunding'],
    customer_shipping: ['received'],
    received: record.type === 'exchange' ? ['exchange_shipping', 'rejected'] : ['refunding', 'rejected'],
    refunding: ['return_completed'],
    exchange_shipping: ['exchange_completed'],
  }
  return base[current] || []
}

function canTransition(record, targetStatus) {
  return getAllowedStatuses(record).includes(canonicalStatus(targetStatus))
}

function getVerificationResult(currentStatus, targetStatus) {
  const current = canonicalStatus(currentStatus)
  const target = canonicalStatus(targetStatus)
  if (target === 'received') return 'pending'
  if (target === 'refunding' || target === 'return_completed' || target === 'exchange_shipping') return 'qualified'
  if (target === 'rejected' && current === 'received') return 'unqualified'
  return undefined
}

module.exports = {
  canReview,
  canTransition,
  canonicalStatus,
  getAllowedStatuses,
  getTargetStatus,
  getVerificationResult,
}
