import { describe, expect, it } from 'vitest'

const rules = require('../../cloudfunctions/createReturn/rules')

describe('createReturn rules', () => {
  it('normalizes items from order data', () => {
    expect(rules.normalizeItems({
      items: [{ productId: 'p1', productName: 'A', quantity: 0, unitPrice: '12.5', spec: '盒' }],
    })).toEqual([{ productId: 'p1', productName: 'A', quantity: 1, unitPrice: 12.5, spec: '盒' }])
  })

  it('normalizes reason and return type', () => {
    expect(rules.normalizeReasonType('quality')).toBe('quality')
    expect(rules.normalizeReasonType('bad')).toBe('other')
    expect(rules.resolveReturnType('exchange')).toBe('exchange')
    expect(rules.resolveReturnType('bad')).toBe('refund_return')
  })

  it('rejects non-quality or exchange aftersales for blood orders', () => {
    expect(rules.validateBloodReturn({ isBloodOrder: true, reasonType: 'change_of_mind', type: 'refund_return' }).success).toBe(false)
    expect(rules.validateBloodReturn({ isBloodOrder: true, reasonType: 'quality', type: 'exchange' }).success).toBe(false)
    expect(rules.validateBloodReturn({ isBloodOrder: true, reasonType: 'quality', type: 'refund_return' }).success).toBe(true)
  })
})
