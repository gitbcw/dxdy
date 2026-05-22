import { describe, expect, it } from 'vitest'

const rules = require('../../cloudfunctions/adjustOrderPrice/rules')

describe('adjustOrderPrice rules', () => {
  it('checks price adjustment permissions', () => {
    expect(rules.canAdjustPrice({ role: 'system_admin' })).toBe(true)
    expect(rules.canAdjustPrice({ role: 'service' })).toBe(true)
    expect(rules.canAdjustPrice({ role: 'service', permissions: { order_price_adjust: false, manage_orders: true } })).toBe(true)
    expect(rules.canAdjustPrice({ role: 'service', permissions: { order_price_adjust: false } })).toBe(false)
    expect(rules.canAdjustPrice({ role: 'customer' })).toBe(false)
  })

  it('validates order status and lower target price', () => {
    const order = { status: 'pending_payment', pricing: { actualAmount: 100 } }
    expect(rules.validatePriceAdjustment(order, 99.99)).toEqual({ success: true })
    expect(rules.validatePriceAdjustment(order, 100)).toMatchObject({ success: false, code: 'BAD_REQUEST' })
    expect(rules.validatePriceAdjustment({ ...order, status: 'completed' }, 50)).toMatchObject({ success: false, code: 'INVALID_STATUS' })
    expect(rules.validatePriceAdjustment({ status: 'pending_payment', pricing: { actualAmount: 0 } }, 50)).toMatchObject({ success: false, code: 'BAD_REQUEST' })
  })

  it('keeps historical commission rate when repricing', () => {
    const order = {
      pricing: { actualAmount: 200 },
      commission: { amount: 30 },
    }
    expect(rules.calculateCommission(order, 100, 0.2)).toBe(15)
    expect(rules.calculateCommission({ pricing: { actualAmount: 0 } }, 100, 0.25)).toBe(25)
  })

  it('builds audit values for price changes', () => {
    expect(rules.getOperatorName({ realName: 'Alice' }, '')).toBe('Alice')
    expect(rules.getOperatorName({}, ' Manual ')).toBe('Manual')

    expect(rules.buildPriceLogEntry(
      { pricing: { actualAmount: 100 } },
      88.888,
      { _id: 'u1' },
      'Alice',
      '2026-05-21 10:00',
    )).toEqual({
      originalPrice: 100,
      modifiedPrice: 88.89,
      operatorId: 'u1',
      operatorName: 'Alice',
      operatedAt: '2026-05-21 10:00',
    })
  })

  it('derives commission adjustment record fields', () => {
    expect(rules.getCommissionAdjustment(10, 12.345)).toEqual({ amount: 2.35, status: 'pending', diff: 2.35 })
    expect(rules.getCommissionAdjustment(10, 8)).toEqual({ amount: 2, status: 'deducted', diff: -2 })
    expect(rules.getCommissionAdjustment(10, 10)).toBeNull()
  })
})
