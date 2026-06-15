function isVisibleToCustomer(product, customer) {
  const visibility = product.visibility || 'all'
  const customerType = customer.customerType || 'personal'
  if (visibility === 'all') return true
  if (visibility === 'personal' || visibility === 'personal_only') return customerType === 'personal'
  if (visibility === 'institution' || visibility === 'institution_only') return customerType === 'institution'
  return true
}

function getUnitPrice(product, customer, now = new Date()) {
  if (product.promotionPrice > 0 && product.promotionStart && product.promotionEnd) {
    const start = new Date(product.promotionStart.replace(/-/g, '/'))
    const end = new Date(product.promotionEnd.replace(/-/g, '/'))
    if (now >= start && now <= end) {
      return Number(product.promotionPrice)
    }
  }
  if (customer.customerType === 'institution' && customer.verificationStatus === 'approved') {
    return Number(product.institutionPrice || product.personalPrice || 0)
  }
  return Number(product.personalPrice || product.institutionPrice || 0)
}

function validateProductForOrder(product, customer, quantity) {
  if (!product) return { success: false, error: '商品不存�? }
  if (product.status !== 'on_sale') return { success: false, error: `商品已下架：${product.name}` }
  if (!isVisibleToCustomer(product, customer)) return { success: false, error: `当前客户类型不可购买�?{product.name}` }
  if (product.isBloodPack && (customer.customerType !== 'institution' || customer.verificationStatus !== 'approved')) {
    return { success: false, error: `血包商品仅限已认证医院客户购买�?{product.name}` }
  }
  if (product.productType === 'card_voucher' && customer.role !== 'salesperson') {
    return { success: false, error: `卡券商品仅限代理商购买：${product.name}` }
  }
  if (typeof product.stock === 'number' && product.stock < quantity) {
    return { success: false, error: `库存不足�?{product.name}` }
  }
  return { success: true }
}

function calculateCouponDiscount(coupon, orderItems, totalAmount) {
  if (!coupon) return { success: false, error: '优惠券不存在' }
  if (coupon.status !== 'available') return { success: false, error: '优惠券不可用' }
  if (coupon.minAmount > 0 && totalAmount < coupon.minAmount) {
    return { success: false, error: `未满 ¥${coupon.minAmount}，不可使用该优惠券` }
  }
  if (coupon.scope === 'products') {
    const match = orderItems.some(item => coupon.scopeIds.includes(item.productId))
    if (!match) return { success: false, error: '优惠券不适用于当前商�? }
  }

  let discountAmount = 0
  if (coupon.couponType === 'fixed') {
    discountAmount = Math.min(coupon.couponValue, totalAmount - 0.01)
  } else if (coupon.couponType === 'discount') {
    discountAmount = Math.round(totalAmount * (1 - coupon.couponValue / 10) * 100) / 100
  } else if (coupon.couponType === 'full_reduction' && totalAmount >= coupon.minAmount) {
    discountAmount = Math.min(coupon.couponValue, totalAmount - 0.01)
  }

  const finalAmount = Math.max(0.01, Math.round((totalAmount - discountAmount) * 100) / 100)
  return { success: true, discountAmount: Math.max(0, discountAmount), finalAmount }
}

function calculatePointsDeduction(pointsToUse, balance, amount) {
  const requested = Math.min(Number(pointsToUse || 0), Number(balance || 0))
  if (requested < 100) return { pointsConsumed: 0, deductionAmount: 0, finalAmount: amount }
  const deductionAmount = Math.floor(requested / 100)
  const pointsConsumed = deductionAmount * 100
  return {
    pointsConsumed,
    deductionAmount,
    finalAmount: Math.max(0.01, Math.round((amount - deductionAmount) * 100) / 100),
  }
}

module.exports = {
  calculateCouponDiscount,
  calculatePointsDeduction,
  getUnitPrice,
  isVisibleToCustomer,
  validateProductForOrder,
}
