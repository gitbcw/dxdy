import { describe, expect, it } from 'vitest'

const rules = require('../../cloudfunctions/createOrder/rules')

describe('createOrder rules', () => {
  it('uses promotion price before customer-specific price', () => {
    const product = {
      personalPrice: 120,
      institutionPrice: 100,
      promotionPrice: 88,
      promotionStart: '2026-05-01',
      promotionEnd: '2026-05-31',
    }
    expect(rules.getUnitPrice(product, { customerType: 'institution' }, new Date('2026-05-21T00:00:00'))).toBe(88)
    expect(rules.getUnitPrice(product, { customerType: 'institution' }, new Date('2026-06-01T00:00:00'))).toBe(100)
  })

  it('validates product availability for blood and card products', () => {
    expect(rules.validateProductForOrder(
      { name: 'blood', status: 'on_sale', isBloodPack: true, stock: 2 },
      { customerType: 'personal', verificationStatus: 'approved' },
      1,
    ).success).toBe(false)
    expect(rules.validateProductForOrder(
      { name: 'card', status: 'on_sale', productType: 'card_voucher', stock: 2 },
      { role: 'salesperson', customerType: 'personal' },
      1,
    ).success).toBe(true)
  })

  it('calculates coupon discounts and preserves minimum payable amount', () => {
    expect(rules.calculateCouponDiscount(
      { status: 'available', minAmount: 100, couponType: 'fixed', couponValue: 500, scope: 'all' },
      [{ productId: 'p1' }],
      120,
    )).toMatchObject({ success: true, discountAmount: 119.99, finalAmount: 0.01 })

    expect(rules.calculateCouponDiscount(
      { status: 'available', minAmount: 0, couponType: 'discount', couponValue: 8, scope: 'products', scopeIds: ['p2'] },
      [{ productId: 'p1' }],
      100,
    ).success).toBe(false)

    expect(rules.calculateCouponDiscount(
      { status: 'used', minAmount: 0, couponType: 'fixed', couponValue: 10, scope: 'all' },
      [{ productId: 'p1' }],
      100,
    ).success).toBe(false)

    expect(rules.calculateCouponDiscount(
      { status: 'available', minAmount: 100, couponType: 'full_reduction', couponValue: 20, scope: 'all' },
      [{ productId: 'p1' }],
      120,
    )).toMatchObject({ success: true, discountAmount: 20, finalAmount: 100 })

    expect(rules.calculateCouponDiscount(
      { status: 'available', minAmount: 100, couponType: 'full_reduction', couponValue: 20, scope: 'all' },
      [{ productId: 'p1' }],
      80,
    ).success).toBe(false)
  })

  it('calculates points deduction by 100 points per yuan', () => {
    expect(rules.calculatePointsDeduction(350, 500, 20)).toEqual({ pointsConsumed: 300, deductionAmount: 3, finalAmount: 17 })
    expect(rules.calculatePointsDeduction(50, 500, 20)).toEqual({ pointsConsumed: 0, deductionAmount: 0, finalAmount: 20 })
    expect(rules.isVisibleToCustomer({ visibility: 'institution' }, { customerType: 'personal' })).toBe(false)
    expect(rules.isVisibleToCustomer({ visibility: 'unknown' }, { customerType: 'personal' })).toBe(true)
  })
})
