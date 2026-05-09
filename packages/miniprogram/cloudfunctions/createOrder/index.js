const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateTime(date) {
  return `${formatDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function error(message, code = 'BAD_REQUEST') {
  return { success: false, code, error: message }
}

function isVisibleToCustomer(product, customer) {
  const visibility = product.visibility || 'all'
  const customerType = customer.customerType || 'personal'
  if (visibility === 'all') return true
  if (visibility === 'personal' || visibility === 'personal_only') return customerType === 'personal'
  if (visibility === 'institution' || visibility === 'institution_only') return customerType === 'institution'
  return true
}

function getUnitPrice(product, customer) {
  const customerType = customer.customerType || 'personal'
  if (customerType === 'institution') {
    return Number(product.institutionPrice || product.personalPrice || 0)
  }
  return Number(product.personalPrice || product.institutionPrice || 0)
}

function getFirstSpec(product) {
  return Array.isArray(product.specs) && product.specs[0] ? product.specs[0].value || '' : ''
}

function getFirstImage(product) {
  return Array.isArray(product.images) && product.images[0] ? product.images[0] : product.image || ''
}

async function getCustomer(customerId, openid) {
  if (!customerId) return null
  try {
    const { data } = await db.collection('users').doc(customerId).get()
    if (!data || data.role !== 'customer' || data._openid !== openid) return null
    return data
  } catch (e) {
    return null
  }
}

async function getProduct(productId) {
  if (!productId) return null
  try {
    const { data } = await db.collection('products').doc(productId).get()
    return data || null
  } catch (e) {
    return null
  }
}

async function buildOrderItems(rawItems, customer) {
  const items = []

  for (const raw of rawItems) {
    const quantity = Math.max(1, Number(raw.quantity || 1))
    const product = await getProduct(raw.productId)
    if (!product) return { error: `商品不存在：${raw.productName || raw.productId || ''}` }
    if (product.status !== 'on_sale') return { error: `商品已下架：${product.name}` }
    if (!isVisibleToCustomer(product, customer)) return { error: `当前客户类型不可购买：${product.name}` }
    if (product.isBloodPack && (customer.customerType !== 'institution' || customer.verificationStatus !== 'approved')) {
      return { error: `血包商品仅限已认证医院客户购买：${product.name}` }
    }
    if (typeof product.stock === 'number' && product.stock < quantity) {
      return { error: `库存不足：${product.name}` }
    }

    const unitPrice = getUnitPrice(product, customer)
    if (!unitPrice || unitPrice <= 0) return { error: `商品价格异常：${product.name}` }

    items.push({
      productId: product._id,
      productName: product.name,
      productImage: getFirstImage(product) || raw.productImage || '',
      spec: raw.spec || getFirstSpec(product),
      quantity,
      unitPrice,
      totalPrice: Math.round(unitPrice * quantity * 100) / 100,
      testReportCode: raw.testReportCode || '',
      batchNo: raw.batchNo || product.batchNo || '',
    })
  }

  return { items }
}

// --- 优惠券验证与核销 ---
async function applyCoupon(couponId, customerId, openid, orderItems, totalAmount, now) {
  try {
    const { data: coupon } = await db.collection('user_coupons').doc(couponId).get()
    if (!coupon) return { success: false, error: '优惠券不存在' }
    if (coupon.status !== 'available') return { success: false, error: '优惠券不可用' }
    if (coupon.userId !== customerId) return { success: false, error: '优惠券不属于当前用户' }

    // 有效期检查
    if (coupon.validFrom && now < coupon.validFrom) return { success: false, error: '优惠券尚未生效' }
    if (coupon.validTo && now > coupon.validTo) return { success: false, error: '优惠券已过期' }

    // 门槛检查
    if (coupon.minAmount > 0 && totalAmount < coupon.minAmount) {
      return { success: false, error: `未满 ¥${coupon.minAmount}，不可使用该优惠券` }
    }

    // 适用范围检查
    if (coupon.scope === 'products') {
      const match = orderItems.some(item => coupon.scopeIds.includes(item.productId))
      if (!match) return { success: false, error: '优惠券不适用于当前商品' }
    } else if (coupon.scope === 'categories') {
      let found = false
      for (const item of orderItems) {
        const product = await getProduct(item.productId)
        if (product && coupon.scopeIds.includes(product.category)) { found = true; break }
      }
      if (!found) return { success: false, error: '优惠券不适用于当前商品分类' }
    }

    // 计算折扣
    let discount = 0
    if (coupon.couponType === 'fixed') {
      discount = Math.min(coupon.couponValue, totalAmount - 0.01)
    } else if (coupon.couponType === 'discount') {
      discount = Math.round(totalAmount * (1 - coupon.couponValue / 10) * 100) / 100
    } else if (coupon.couponType === 'full_reduction') {
      if (totalAmount >= coupon.minAmount) {
        discount = Math.min(coupon.couponValue, totalAmount - 0.01)
      }
    }

    const finalAmount = Math.max(0.01, Math.round((totalAmount - discount) * 100) / 100)

    // 原子核销：更新状态为 used
    const updateRes = await db.collection('user_coupons').doc(couponId).update({
      data: { status: 'used', usedAt: now, updatedAt: now }
    })
    if (updateRes.stats.updated === 0) {
      return { success: false, error: '优惠券已被使用' }
    }

    return {
      success: true,
      discountAmount: discount,
      finalAmount,
      couponRecord: {
        userCouponId: couponId,
        couponName: coupon.couponName,
        couponType: coupon.couponType,
        discountAmount: discount,
      }
    }
  } catch (e) {
    return { success: false, error: '优惠券验证失败' }
  }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return error('登录状态无效', 'UNAUTHORIZED')

  // 读取系统配置（佣金率等）
  let commissionRate = 0.2
  try {
    const { data: configDoc } = await db.collection('config').doc('system').get()
    if (configDoc && typeof configDoc.commissionRate === 'number') commissionRate = configDoc.commissionRate
  } catch (_e) { /* use default */ }

  const customer = await getCustomer(event.customerId, openid)
  if (!customer) return error('客户不存在或无权下单', 'FORBIDDEN')

  const rawItems = Array.isArray(event.items) ? event.items : []
  if (!rawItems.length) return error('订单商品不能为空')

  const built = await buildOrderItems(rawItems, customer)
  if (built.error) return error(built.error)

  const type = event.type === 'booking' ? 'booking' : 'normal'
  if (type === 'booking' && (!event.booking || !event.booking.date || !event.booking.location)) {
    return error('请补全预约信息')
  }

  const defaultAddress = Array.isArray(customer.addresses) ? customer.addresses.find((address) => address.isDefault) : null
  const shippingAddress = event.shippingAddress || defaultAddress
  if (!shippingAddress) return error('请选择收货地址')

  const totalAmount = built.items.reduce((sum, item) => sum + item.totalPrice, 0)
  let actualAmount = Math.round(totalAmount * 100) / 100
  const now = formatDateTime(new Date())

  // --- 加急费用 ---
  let urgentFee = 0
  let isUrgent = false
  if (event.isUrgent) {
    // 查第一个商品的 urgentConfig
    const firstItem = built.items[0]
    if (firstItem) {
      try {
        const { data: product } = await db.collection('products').doc(firstItem.productId).get()
        if (product && product.urgentConfig && product.urgentConfig.enabled) {
          urgentFee = parseFloat(product.urgentConfig.extraFee) || 0
          isUrgent = true
          actualAmount = Math.round((actualAmount + urgentFee) * 100) / 100
        }
      } catch (_e) { /* skip urgent */ }
    }
  }

  // --- 优惠券处理 ---
  let couponRecord = null
  let discountAmount = 0
  if (event.couponId) {
    const couponResult = await applyCoupon(event.couponId, customer._id, openid, built.items, actualAmount, now)
    if (!couponResult.success) return error(couponResult.error)
    couponRecord = couponResult.couponRecord
    discountAmount = couponResult.discountAmount
    actualAmount = couponResult.finalAmount
  }

  const order = {
    orderNo: `DD${Date.now()}`,
    type,
    status: 'pending_payment',
    customerId: customer._id,
    customerName: customer.nickname || customer.name || customer.phone || '客户',
    customerOpenid: openid,
    salespersonId: customer.boundSalespersonId || '',
    clerkId: null,
    items: built.items,
    pricing: {
      originalAmount: Math.round(totalAmount * 100) / 100,
      actualAmount,
      priceLog: [],
      shippingFee: 0, urgentFee, pointsDeduction: 0, refundedAmount: 0,
      ...(couponRecord ? { coupon: couponRecord } : {}),
    },
    payment: { status: 'unpaid', method: '', paidAt: '', transactionId: '' },
    shipping: {
      address: shippingAddress,
      trackingNo: null,
      company: null,
      logistics: [],
      ...(isUrgent ? { urgent: true } : {}),
    },
    ...(type === 'booking' ? { booking: event.booking } : {}),
    returnRecordId: null,
    commission: {
      status: 'pending',
      amount: Math.round(actualAmount * commissionRate * 100) / 100,
      settledAt: null,
    },
    ...(event.remark ? { remark: event.remark } : {}),
    createdAt: now,
    updatedAt: now,
  }

  const { _id } = await db.collection('orders').add({ data: order })

  // 生成提成记录
  if (order.salespersonId && order.commission.amount > 0) {
    try {
      await db.collection('commission_records').add({
        data: {
          salespersonId: order.salespersonId,
          customerId: customer._id,
          orderId: _id,
          orderNo: order.orderNo,
          amount: order.commission.amount,
          status: 'pending',
          sourceType: 'order',
          description: `订单 ${order.orderNo} 提成 ¥${order.commission.amount}`,
          createdAt: now,
          updatedAt: now,
        },
      })
    } catch (_e) { /* non-critical */ }
  }

  return { success: true, order: { ...order, id: _id } }
}
