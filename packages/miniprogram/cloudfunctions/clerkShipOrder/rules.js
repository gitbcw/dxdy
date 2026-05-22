function canShip(user, order) {
  const role = user && user.role
  if (['admin', 'system_admin', 'service'].includes(role)) return true
  if (role !== 'clerk') return false
  if (!order.clerkId) return true
  return order.clerkId === user._id
}

function hasBloodItem(order) {
  return (order.items || []).some((item) => String(item.productName || item.name || '').includes('血'))
}

function validateShippingInput(input) {
  if (!input.orderId) return { success: false, error: '订单参数缺失' }
  if (!input.expressCompany) return { success: false, error: '请选择快递公司' }
  if (!input.expressNo) return { success: false, error: '请填写快递单号' }
  if (input.isModify && !input.modifyReason) return { success: false, error: '请填写修改原因' }
  if (input.hasBloodItem) {
    if (!input.packageType) return { success: false, error: '请选择包装类型' }
    if (!input.coldChainMethod) return { success: false, error: '请选择冷链方式' }
    if (!input.boxTemperature) return { success: false, error: '请填写箱内温度' }
  }
  if (input.abnormalFlag && (!input.abnormalType || !input.abnormalReason)) {
    return { success: false, error: '请填写异常类型和原因' }
  }
  const validAbnormalTypes = ['partial', 'damaged', 'address_changed', 'near_expiry', 'other']
  if (input.abnormalFlag && !validAbnormalTypes.includes(input.abnormalType)) {
    return { success: false, error: '异常类型无效' }
  }
  return { success: true }
}

module.exports = {
  canShip,
  hasBloodItem,
  validateShippingInput,
}
