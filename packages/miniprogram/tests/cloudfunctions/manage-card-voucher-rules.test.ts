import { describe, expect, it } from 'vitest'

const rules = require('../../cloudfunctions/manageCardVoucher/rules')

describe('manageCardVoucher rules', () => {
  it('validates salesperson gift ownership and customer relationship', () => {
    const operator = { _id: 's1', role: 'salesperson', customers: ['u1'] }
    const card = { status: 'ungifted', purchaserId: 's1' }
    expect(rules.canGiftCard(operator, card, 'u1', { _id: 'u1', customerType: 'institution' })).toEqual({ success: true })
    expect(rules.canGiftCard(operator, card, 'u2', { _id: 'u2', customerType: 'institution', boundSalespersonId: 's1' })).toEqual({ success: true })
    expect(rules.canGiftCard(operator, card, 'u3', { _id: 'u3', customerType: 'institution' })).toMatchObject({ success: false, code: 'NOT_OWN_CUSTOMER' })
    expect(rules.canGiftCard({ ...operator, role: 'customer' }, card, 'u1', { _id: 'u1', customerType: 'institution' })).toMatchObject({ success: false, code: 'INVALID_ROLE' })
    expect(rules.canGiftCard(operator, { ...card, status: 'gifted' }, 'u1', { _id: 'u1', customerType: 'institution' })).toMatchObject({ success: false, code: 'INVALID_CARD_STATUS' })
    expect(rules.canGiftCard(operator, card, 'u1', null)).toMatchObject({ success: false, code: 'NO_TARGET_USER' })
  })

  it('validates claim and regift holder rules', () => {
    const user = { _id: 'u1' }
    const card = { status: 'gifted', currentHolderId: 'u1' }
    expect(rules.canClaimCard(user, card)).toEqual({ success: true })
    expect(rules.canClaimCard({ _id: 'u2' }, card)).toMatchObject({ success: false, code: 'NOT_HOLDER' })
    expect(rules.canRegiftCard(user, card, { _id: 'u2', customerType: 'institution' })).toEqual({ success: true })
    expect(rules.canRegiftCard(user, card, { _id: 'u1', customerType: 'institution' })).toMatchObject({ success: false, code: 'SELF_TARGET' })
    expect(rules.canRegiftCard(user, card, { _id: 'u2', customerType: 'personal' })).toMatchObject({ success: false, code: 'INVALID_TARGET_TYPE' })
  })

  it('validates redemption eligibility and product constraints', () => {
    const user = { _id: 'u1', customerType: 'institution', verificationStatus: 'approved' }
    const card = { status: 'claimed', currentHolderId: 'u1', redeemableCategory: 'blood', expiresAt: '2026-12-01 00:00' }
    const product = { productType: 'blood_pack', status: 'on_sale', stock: 1, category: 'blood' }
    expect(rules.canRedeemCard(user, card, product, '2026-05-21 12:00')).toEqual({ success: true })
    expect(rules.canRedeemCard({ ...user, verificationStatus: 'pending' }, card, product, '2026-05-21 12:00')).toMatchObject({ success: false, code: 'UNVERIFIED' })
    expect(rules.canRedeemCard(user, { ...card, expiresAt: '2026-01-01 00:00' }, product, '2026-05-21 12:00')).toMatchObject({ success: false, code: 'EXPIRED' })
    expect(rules.canRedeemCard(user, card, { ...product, category: 'chemistry' }, '2026-05-21 12:00')).toMatchObject({ success: false, code: 'CATEGORY_MISMATCH' })
  })

  it('validates void permissions and builds card side-effect payloads', () => {
    expect(rules.canVoidCard({ _id: 's1', role: 'salesperson' }, { purchaserId: 's1', status: 'claimed' })).toEqual({ success: true })
    expect(rules.canVoidCard({ _id: 's2', role: 'salesperson' }, { purchaserId: 's1', status: 'claimed' })).toMatchObject({ success: false, code: 'FORBIDDEN' })
    expect(rules.canVoidCard({ _id: 'a1', role: 'admin' }, { purchaserId: 's1', status: 'redeemed' })).toMatchObject({ success: false, code: 'INVALID_CARD_STATUS' })
    expect(rules.canVoidCard(null, { purchaserId: 's1', status: 'claimed' })).toMatchObject({ success: false, code: 'NO_OPERATOR' })

    expect(rules.buildGiftEntry(
      { _id: 'u1', nickname: 'from' },
      { _id: 'u2', phone: '13800000000' },
      'regift',
      '2026-05-21 12:00',
    )).toEqual({
      fromUserId: 'u1',
      fromUserName: 'from',
      toUserId: 'u2',
      toUserName: '13800000000',
      action: 'regift',
      at: '2026-05-21 12:00',
    })
  })

  it('builds redemption order with zero payable amount', () => {
    const order = rules.buildRedemptionOrder({
      card: { _id: 'cv1', cardNo: 'CARD001', purchaserId: 's1' },
      product: {
        _id: 'p1',
        name: 'Blood Pack',
        images: ['img'],
        specs: [{ value: 'A' }],
        institutionPrice: 99,
      },
      user: { _id: 'u1', nickname: 'Hospital' },
      openid: 'openid',
      shippingAddress: { address: 'addr', name: 'name', phone: 'phone' },
      now: '2026-05-21 12:00',
      orderNo: 'CV1',
    })

    expect(order).toMatchObject({
      orderNo: 'CV1',
      type: 'card_redemption',
      status: 'pending_shipment',
      pricing: { originalAmount: 99, actualAmount: 0 },
      payment: { status: 'paid', method: 'card_voucher', transactionId: 'CARD001' },
      cardVoucherId: 'cv1',
    })
    expect(order.items[0]).toMatchObject({ productId: 'p1', unitPrice: 99, totalPrice: 99 })
  })

  it('rejects invalid redemption targets', () => {
    const user = { _id: 'u1', customerType: 'personal', verificationStatus: 'pending' }
    const card = { status: 'gifted', currentHolderId: 'u1' }
    expect(rules.canClaimCard(null, card)).toMatchObject({ success: false, code: 'NO_USER' })
    expect(rules.canRegiftCard(user, null, null)).toMatchObject({ success: false, code: 'NO_CARD' })
    expect(rules.canRedeemCard(user, card, null, '2026-05-21 12:00')).toMatchObject({ success: false, code: 'INVALID_USER_TYPE' })
  })
})
