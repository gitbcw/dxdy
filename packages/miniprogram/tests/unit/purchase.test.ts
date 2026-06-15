import { describe, expect, it } from 'vitest'
import { canPurchase } from '../../miniprogram/services/purchase'

describe('purchase checks', () => {
  it('rejects unauthenticated users', () => {
    expect(canPurchase({ status: 'on_sale' }, null)).toEqual({ allowed: false, reason: '请先登录', code: 'not_logged_in' })
  })

  it('accepts approved institution users for blood packs', () => {
    expect(canPurchase(
      { status: 'on_sale', productType: 'blood_pack', stock: 10 },
      { customerType: 'institution', verificationStatus: 'approved', role: 'customer' },
      1,
    ).allowed).toBe(true)
  })

  it('enforces visibility, card voucher, stock, and quantity limits', () => {
    expect(canPurchase(
      { status: 'on_sale', visibility: 'personal_only', stock: 10 },
      { customerType: 'institution', role: 'customer' },
      1,
    )).toMatchObject({ allowed: false, code: 'visibility' })

    expect(canPurchase(
      { status: 'on_sale', productType: 'card_voucher', stock: 10 },
      { customerType: 'institution', role: 'customer' },
      1,
    )).toMatchObject({ allowed: false, code: 'visibility' })

    expect(canPurchase(
      { status: 'on_sale', stock: 1 },
      { customerType: 'institution', role: 'customer' },
      2,
    )).toMatchObject({ allowed: false, code: 'stock_insufficient' })

    expect(canPurchase(
      {
        status: 'on_sale',
        stock: 10,
        purchaseLimit: { minQuantity: 2, maxQuantityPerOrder: 5, maxQuantityPerUser: 10 },
      },
      { customerType: 'institution', role: 'customer' },
      1,
    )).toMatchObject({ allowed: false, code: 'purchase_limit' })
    expect(canPurchase(
      {
        status: 'on_sale',
        stock: 10,
        purchaseLimit: { minQuantity: 2, maxQuantityPerOrder: 5, maxQuantityPerUser: 10 },
      },
      { customerType: 'institution', role: 'customer' },
      6,
    )).toMatchObject({ allowed: false, code: 'purchase_limit' })
  })
})
