import { describe, expect, it } from 'vitest'

const rules = require('../../cloudfunctions/reviewReturn/rules')

describe('reviewReturn rules', () => {
  it('normalizes target statuses', () => {
    expect(rules.canonicalStatus('pending_return_ship')).toBe('customer_shipping')
    expect(rules.getTargetStatus({ approved: true })).toBe('approved')
    expect(rules.getTargetStatus({ status: 'returned' })).toBe('received')
  })

  it('checks review permissions', () => {
    expect(rules.canReview({ role: 'system_admin' })).toBe(true)
    expect(rules.canReview({ role: 'service', permissions: { manage_returns: true } })).toBe(true)
    expect(rules.canReview({ role: 'service', permissions: { manage_returns: false } })).toBe(false)
    expect(rules.canReview({ role: 'customer' })).toBe(false)
  })

  it('enforces status transitions', () => {
    expect(rules.canTransition({ status: 'pending_review', type: 'refund_return' }, 'approved')).toBe(true)
    expect(rules.canTransition({ status: 'pending_review', type: 'refund_return' }, 'refunding')).toBe(false)
    expect(rules.canTransition({ status: 'received', type: 'exchange' }, 'exchange_shipping')).toBe(true)
  })

  it('derives verification result from status transitions', () => {
    expect(rules.getVerificationResult('customer_shipping', 'received')).toBe('pending')
    expect(rules.getVerificationResult('received', 'refunding')).toBe('qualified')
    expect(rules.getVerificationResult('received', 'rejected')).toBe('unqualified')
    expect(rules.getVerificationResult('pending_review', 'approved')).toBeUndefined()
  })
})
