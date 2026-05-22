import { describe, expect, it } from 'vitest'

const rules = require('../../cloudfunctions/updateOrderStatus/rules')

describe('updateOrderStatus rules', () => {
  it('allows owners to cancel unpaid orders and confirm receipts', () => {
    const user = { _id: 'u1', role: 'customer' }
    expect(rules.canTransition({ customerId: 'u1', status: 'pending_payment' }, 'cancelled', user, '')).toBe(true)
    expect(rules.canTransition({ customerId: 'u1', status: 'pending_receipt' }, 'completed', user, '')).toBe(true)
    expect(rules.canTransition({ customerId: 'u1', status: 'pending_shipment' }, 'cancelled', user, '')).toBe(false)
  })

  it('allows staff transitions across service and shipment states', () => {
    const staff = { role: 'service' }
    expect(rules.canTransition({ status: 'pending_confirmation' }, 'confirmed', staff, '')).toBe(true)
    expect(rules.canTransition({ status: 'confirmed' }, 'in_service', staff, '')).toBe(true)
    expect(rules.canTransition({ status: 'in_service' }, 'completed', staff, '')).toBe(true)
    expect(rules.canTransition({ status: 'pending_payment' }, 'completed', staff, '')).toBe(false)
    expect(rules.canTransition({ status: 'pending_confirmation' }, 'confirmed', { role: 'clerk' }, '')).toBe(false)
  })

  it('builds completion update data with commission settlement fields', () => {
    expect(rules.buildOrderStatusUpdate(
      { commission: { amount: 12 } },
      'completed',
      '2026-05-21 12:00',
    )).toEqual({
      status: 'completed',
      updatedAt: '2026-05-21 12:00',
      completedAt: '2026-05-21 12:00',
      'commission.status': 'settled',
      'commission.settledAt': '2026-05-21 12:00',
    })
  })

  it('derives follow-up effects for completed orders', () => {
    expect(rules.shouldSettleCommission(
      { salespersonId: 's1', commission: { amount: 10 } },
      'completed',
    )).toBe(true)
    expect(rules.shouldVerifyCardVoucher(
      { type: 'card_redemption', cardVoucherId: 'cv1' },
      'completed',
    )).toBe(true)
    expect(rules.calculateEarnedPoints({ type: 'normal', pricing: { actualAmount: 88.8 } }, 2)).toBe(177)
    expect(rules.calculateEarnedPoints({ type: 'recharge', pricing: { actualAmount: 100 } }, 2)).toBe(0)
    expect(rules.shouldAwardReferral({ type: 'normal' }, 1, { referredBy: 'u0' })).toBe(true)
    expect(rules.shouldAwardReferral({ type: 'normal' }, 2, { referredBy: 'u0' })).toBe(false)
  })
})
