import { describe, expect, it } from 'vitest'

const rules = require('../../cloudfunctions/clerkShipOrder/rules')

describe('clerkShipOrder rules', () => {
  it('checks shipping permissions', () => {
    expect(rules.canShip({ role: 'system_admin' }, { clerkId: 'c1' })).toBe(true)
    expect(rules.canShip({ role: 'clerk', _id: 'c1' }, { clerkId: 'c1' })).toBe(true)
    expect(rules.canShip({ role: 'clerk', _id: 'c2' }, { clerkId: 'c1' })).toBe(false)
    expect(rules.canShip({ role: 'customer', _id: 'u1' }, { clerkId: '' })).toBe(false)
  })

  it('detects blood orders', () => {
    expect(rules.hasBloodItem({ items: [{ productName: '血包常用' }] })).toBe(true)
    expect(rules.hasBloodItem({ items: [{ productName: '普通营养膏' }] })).toBe(false)
  })

  it('validates shipping input', () => {
    expect(rules.validateShippingInput({ orderId: '', expressCompany: '顺丰', expressNo: 'SF1' }).success).toBe(false)
    expect(rules.validateShippingInput({ orderId: 'o1', expressCompany: '顺丰', expressNo: 'SF1', isModify: true }).success).toBe(false)
    expect(rules.validateShippingInput({
      orderId: 'o1',
      expressCompany: '顺丰',
      expressNo: 'SF1',
      hasBloodItem: true,
      packageType: '冷藏箱',
      coldChainMethod: '冰袋',
      boxTemperature: '4C',
    }).success).toBe(true)
    expect(rules.validateShippingInput({
      orderId: 'o1',
      expressCompany: '顺丰',
      expressNo: 'SF1',
      hasBloodItem: true,
      packageType: '冷藏箱',
      coldChainMethod: '冰袋',
    }).success).toBe(false)
    expect(rules.validateShippingInput({
      orderId: 'o1',
      expressCompany: '顺丰',
      expressNo: 'SF1',
      abnormalFlag: true,
      abnormalType: 'invalid',
      abnormalReason: 'bad',
    }).success).toBe(false)
  })
})
