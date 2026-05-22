import { describe, expect, it } from 'vitest'

const rules = require('../../cloudfunctions/payOrder/rules')

describe('payOrder rules', () => {
  it('validates owner, status, and amount before payment', () => {
    const order = {
      _openid: 'openid-a',
      status: 'pending_payment',
      pricing: { actualAmount: 120 },
    }

    expect(rules.canPayOrder(order, 'openid-a')).toEqual({ success: true })
    expect(rules.canPayOrder(order, 'openid-b')).toMatchObject({ success: false, code: 'FORBIDDEN' })
    expect(rules.canPayOrder({ ...order, status: 'completed' }, 'openid-a')).toMatchObject({ success: false, code: 'INVALID_STATUS' })
    expect(rules.canPayOrder({ ...order, pricing: { actualAmount: 0 } }, 'openid-a')).toMatchObject({ success: false, code: 'BAD_REQUEST' })
  })

  it('prefers customerOpenid when checking ownership', () => {
    const order = { _openid: 'creator', customerOpenid: 'customer' }
    expect(rules.isOwner(order, 'customer')).toBe(true)
    expect(rules.isOwner(order, 'creator')).toBe(false)
  })

  it('derives payment method, next status, and wallet behavior', () => {
    expect(rules.normalizePaymentMethod('wallet')).toBe('wallet')
    expect(rules.normalizePaymentMethod('unknown')).toBe('wechat')
    expect(rules.getNextStatus('booking')).toBe('pending_confirmation')
    expect(rules.getNextStatus('card_order')).toBe('completed')
    expect(rules.getNextStatus('recharge')).toBe('completed')
    expect(rules.getNextStatus('normal')).toBe('pending_shipment')
    expect(rules.shouldDeductWallet('wallet', 'normal')).toBe(true)
    expect(rules.shouldDeductWallet('wallet', 'recharge')).toBe(false)
  })

  it('calculates recharge credit and commission totals', () => {
    expect(rules.calculateRechargeCredit({ rechargeTier: { amount: 100, bonus: 20 } }, 100)).toBe(120)
    expect(rules.calculateRechargeCredit({ rechargeTier: { bonus: 10 } }, 80)).toBe(90)
    expect(rules.hasEnoughWalletBalance({ wallet: { balance: 50 } }, 49.99)).toBe(true)
    expect(rules.hasEnoughWalletBalance({ wallet: { balance: 50 } }, 50.01)).toBe(false)
    expect(rules.sumCommission([{ amount: 3 }, { amount: 4.5 }, {}])).toBe(7.5)
  })
})
