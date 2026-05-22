function normalizeItems(order, eventItems) {
  const source = Array.isArray(eventItems) && eventItems.length ? eventItems : order.items || []
  return source.map((item) => ({
    productId: item.productId || '',
    productName: item.productName || '',
    quantity: Math.max(1, Number(item.quantity || 1)),
    unitPrice: Number(item.unitPrice || 0),
    spec: item.spec || '',
  }))
}

function normalizeReasonType(reasonType) {
  const validReasonTypes = ['quality', 'change_of_mind', 'other']
  return validReasonTypes.includes(reasonType) ? reasonType : 'other'
}

function resolveReturnType(type) {
  return ['refund_return', 'refund_only', 'exchange'].includes(type) ? type : 'refund_return'
}

function validateBloodReturn({ isBloodOrder, reasonType, type }) {
  if (isBloodOrder && reasonType !== 'quality') {
    return { success: false, error: '血包商品仅支持质量问题售后' }
  }
  if (isBloodOrder && type === 'exchange') {
    return { success: false, error: '血包商品不支持换货，请选择退货退款' }
  }
  return { success: true }
}

module.exports = {
  normalizeItems,
  normalizeReasonType,
  resolveReturnType,
  validateBloodReturn,
}
