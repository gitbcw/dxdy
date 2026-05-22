function canGiftCard(operator, card, toUserId, toUser) {
  if (!operator) return { success: false, code: 'NO_OPERATOR' }
  if (operator.role !== 'salesperson') return { success: false, code: 'INVALID_ROLE' }
  if (!card) return { success: false, code: 'NO_CARD' }
  if (card.status !== 'ungifted') return { success: false, code: 'INVALID_CARD_STATUS' }
  if (card.purchaserId !== operator._id) return { success: false, code: 'NOT_PURCHASER' }
  if (!toUser) return { success: false, code: 'NO_TARGET_USER' }
  if (toUser.customerType !== 'institution') return { success: false, code: 'INVALID_TARGET_TYPE' }

  const salespersonCustomers = operator.customers || []
  if (!salespersonCustomers.includes(toUserId) && toUser.boundSalespersonId !== operator._id) {
    return { success: false, code: 'NOT_OWN_CUSTOMER' }
  }

  return { success: true }
}

function canClaimCard(user, card) {
  if (!user) return { success: false, code: 'NO_USER' }
  if (!card) return { success: false, code: 'NO_CARD' }
  if (card.status !== 'gifted') return { success: false, code: 'INVALID_CARD_STATUS' }
  if (card.currentHolderId !== user._id) return { success: false, code: 'NOT_HOLDER' }
  return { success: true }
}

function canRegiftCard(user, card, toUser) {
  if (!user) return { success: false, code: 'NO_USER' }
  if (!card) return { success: false, code: 'NO_CARD' }
  if (!['claimed', 'gifted'].includes(card.status)) return { success: false, code: 'INVALID_CARD_STATUS' }
  if (card.currentHolderId !== user._id) return { success: false, code: 'NOT_HOLDER' }
  if (!toUser) return { success: false, code: 'NO_TARGET_USER' }
  if (toUser._id === user._id) return { success: false, code: 'SELF_TARGET' }
  if (toUser.customerType !== 'institution') return { success: false, code: 'INVALID_TARGET_TYPE' }
  return { success: true }
}

function canRedeemCard(user, card, product, now) {
  if (!user) return { success: false, code: 'NO_USER' }
  if (user.customerType !== 'institution') return { success: false, code: 'INVALID_USER_TYPE' }
  if (user.verificationStatus !== 'approved') return { success: false, code: 'UNVERIFIED' }
  if (!card) return { success: false, code: 'NO_CARD' }
  if (card.status !== 'claimed') return { success: false, code: 'INVALID_CARD_STATUS' }
  if (card.currentHolderId !== user._id) return { success: false, code: 'NOT_HOLDER' }
  if (card.expiresAt && card.expiresAt < now) return { success: false, code: 'EXPIRED' }
  if (!product) return { success: false, code: 'NO_PRODUCT' }
  if (product.productType !== 'blood_pack' && !product.isBloodPack) return { success: false, code: 'INVALID_PRODUCT_TYPE' }
  if (product.status !== 'on_sale') return { success: false, code: 'PRODUCT_OFF_SALE' }
  if (product.stock < 1) return { success: false, code: 'OUT_OF_STOCK' }
  if (card.redeemableCategory && product.category !== card.redeemableCategory) {
    return { success: false, code: 'CATEGORY_MISMATCH' }
  }
  return { success: true }
}

function canVoidCard(operator, card) {
  if (!operator) return { success: false, code: 'NO_OPERATOR' }
  if (!card) return { success: false, code: 'NO_CARD' }
  if (!['ungifted', 'gifted', 'claimed'].includes(card.status)) return { success: false, code: 'INVALID_CARD_STATUS' }

  const isAdmin = ['admin', 'system_admin', 'service'].includes(operator.role)
  const isPurchaser = card.purchaserId === operator._id
  if (!isAdmin && !isPurchaser) return { success: false, code: 'FORBIDDEN' }
  return { success: true }
}

function buildGiftEntry(fromUser, toUser, action, now) {
  return {
    fromUserId: fromUser._id,
    fromUserName: fromUser.nickname || fromUser.phone || '',
    toUserId: toUser._id,
    toUserName: toUser.nickname || toUser.phone || '',
    action,
    at: now,
  }
}

function buildRedemptionOrder({ card, product, user, openid, shippingAddress, now, orderNo }) {
  const price = product.institutionPrice || product.personalPrice || 0
  return {
    orderNo,
    type: 'card_redemption',
    status: 'pending_shipment',
    customerId: user._id,
    customerName: user.nickname || user.phone || '',
    customerOpenid: openid,
    salespersonId: card.purchaserId || '',
    clerkId: null,
    items: [{
      productId: product._id,
      productName: product.name,
      productImage: product.images?.[0] || '',
      spec: product.specs?.[0]?.value || '标准规格',
      quantity: 1,
      unitPrice: price,
      totalPrice: price,
    }],
    pricing: {
      originalAmount: price,
      actualAmount: 0,
      priceLog: `卡券兑换 ${card.cardNo}`,
      shippingFee: 0,
      urgentFee: 0,
      pointsDeduction: 0,
      refundedAmount: 0,
    },
    payment: {
      status: 'paid',
      method: 'card_voucher',
      paidAt: now,
      transactionId: card.cardNo,
    },
    shipping: shippingAddress ? {
      address: shippingAddress.address || '',
      name: shippingAddress.name || '',
      phone: shippingAddress.phone || '',
      trackingNo: '',
      company: '',
    } : { address: '', name: '', phone: '', trackingNo: '', company: '' },
    commission: { status: 'none', amount: 0, settledAt: null },
    cardVoucherId: card._id,
    returnRecordId: null,
    remark: `卡券 ${card.cardNo} 兑换`,
    createdAt: now,
    updatedAt: now,
  }
}

module.exports = {
  buildGiftEntry,
  buildRedemptionOrder,
  canClaimCard,
  canGiftCard,
  canRedeemCard,
  canRegiftCard,
  canVoidCard,
}
