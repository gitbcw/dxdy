const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const BLOOD_BOOKING_PRODUCT_IMAGE = '/assets/generated/optimized/product-blood-booking.png'

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateTime(date) {
  return `${formatDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function parseBeijingDateTime(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/)
  if (!match) return null
  const [, year, month, day, hours, minutes] = match
  const time = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hours) - 8, Number(minutes), 0)
  return Number.isFinite(time) ? new Date(time) : null
}

function error(message, code = 'BAD_REQUEST') {
  return { success: false, code, error: message }
}

function getCustomerCity(customer) {
  const addresses = Array.isArray(customer && customer.addresses) ? customer.addresses : []
  if (!addresses.length) return ''
  const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0]
  return String((defaultAddr && defaultAddr.city) || '').trim()
}

function normalizeCity(value) {
  return String(value || '').replace(/(省|市|特别行政区|自治区|地区|自治州|盟)$/, '').trim()
}

function isRegionVisible(product, city) {
  if (!city) return true
  const normalizedCity = normalizeCity(city)
  const match = (regions) => regions.some((region) => normalizeCity(region) === normalizedCity)
  const hidden = Array.isArray(product && product.hiddenRegions) ? product.hiddenRegions : []
  if (hidden.length && match(hidden)) return false
  const visible = Array.isArray(product && product.visibleRegions) ? product.visibleRegions : []
  if (visible.length && !match(visible)) return false
  return true
}

function isVisibleToCustomer(product, customer) {
  const city = getCustomerCity(customer)
  if (!isRegionVisible(product, city)) return false
  const visibility = product.visibility || 'all'
  const customerType = customer.customerType || 'personal'
  if (visibility === 'all') return true
  if (visibility === 'personal' || visibility === 'personal_only') return customerType === 'personal'
  if (visibility === 'institution' || visibility === 'institution_only') return customerType === 'institution'
  return true
}

function getUnitPrice(product, customer) {
  // 促销价判断：当前时间在促销窗口内且促销价有效时优先使用
  if (product.promotionPrice > 0 && product.promotionStart && product.promotionEnd) {
    const now = new Date()
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

function getFirstSpec(product) {
  return Array.isArray(product.specs) && product.specs[0] ? product.specs[0].value || '' : ''
}

function getFirstImage(product) {
  return Array.isArray(product.images) && product.images[0] ? product.images[0] : product.image || ''
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function getBloodBookingPrice(systemConfig, species, bloodType, volumeMl) {
  const rules = systemConfig && systemConfig.bloodBookingConfig && Array.isArray(systemConfig.bloodBookingConfig.priceRules)
    ? systemConfig.bloodBookingConfig.priceRules
    : []
  const rule = rules.find((item) => (
    item &&
    item.species === species &&
    String(item.bloodType || '') === bloodType &&
    Number(item.volumeMl) === Number(volumeMl)
  ))
  const legacyPrice = roundMoney(rule && rule.price)
  const storePrice = roundMoney((rule && rule.storePrice) || legacyPrice)
  const retailPrice = roundMoney((rule && rule.retailPrice) || (storePrice > 0 ? storePrice * 2 : 0))
  return {
    storePrice: Number.isFinite(storePrice) && storePrice > 0 ? storePrice : 0,
    retailPrice: Number.isFinite(retailPrice) && retailPrice > 0 ? retailPrice : 0,
  }
}

async function getCustomer(customerId, openid) {
  if (!customerId) return null
  try {
    const { data } = await db.collection('users').doc(customerId).get()
    if (!data || data._openid !== openid) return null
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

async function getBloodBookingInvite(inviteId) {
  if (!inviteId) return null
  try {
    const { data } = await db.collection('blood_booking_invites').doc(inviteId).get()
    if (!data || data.status !== 'active') return null
    const expiresAt = parseBeijingDateTime(data.expiresAt)
    if (expiresAt && expiresAt.getTime() < Date.now()) return null
    return data
  } catch (_e) {
    return null
  }
}

async function buildOrderItems(rawItems, customer, systemConfig, booking = {}) {
  const items = []
  let bloodBookingPricing = null

  for (const raw of rawItems) {
    const quantity = Math.max(1, Number(raw.quantity || 1))
    if (raw.bookingRequest === true || raw.productType === 'blood_booking') {
      const isInstitutionBooking = customer.customerType === 'institution' && customer.verificationStatus === 'approved'
      const invite = booking.inviteId ? await getBloodBookingInvite(String(booking.inviteId)) : null
      const isPersonalInviteBooking = customer.customerType === 'personal' && !!invite
      if (!isInstitutionBooking && !isPersonalInviteBooking) {
        return { error: '用血预约仅限已认证医院客户，或个人客户通过医院预约二维码提交' }
      }
      const species = String(raw.species || '').trim()
      const bloodType = String(raw.bloodType || '').trim()
      const volumeMl = Number(raw.volumeMl || 0)
      if (!['dog', 'cat'].includes(species)) return { error: '请选择犬/猫用血类型' }
      if (!bloodType) return { error: '请选择血型' }
      if (!Number.isFinite(volumeMl) || volumeMl <= 0) return { error: '请输入需要的血量' }

      const speciesLabel = species === 'dog' ? '犬血' : '猫血'
      const pricePair = getBloodBookingPrice(systemConfig, species, bloodType, volumeMl)
      const unitPrice = isPersonalInviteBooking ? pricePair.retailPrice : pricePair.storePrice
      if (!unitPrice || unitPrice <= 0) return { error: '当前血型和血量暂未配置价格，请联系客服' }
      bloodBookingPricing = {
        priceMode: isPersonalInviteBooking ? 'retail' : 'store',
        storePrice: pricePair.storePrice,
        retailPrice: pricePair.retailPrice,
        hospitalReferrerId: invite ? invite.hospitalId : '',
        hospitalReferrerName: invite ? (invite.hospitalName || '') : '',
        inviteId: invite ? invite._id : '',
        hospitalCommissionAmount: isPersonalInviteBooking ? Math.max(0, roundMoney(pricePair.retailPrice - pricePair.storePrice)) : 0,
        hospitalCommissionStatus: isPersonalInviteBooking ? 'pending_payment' : '',
      }
      items.push({
        productId: raw.productId || `blood_booking_${species}`,
        productName: raw.productName || `${speciesLabel}预约`,
        productImage: raw.productImage || BLOOD_BOOKING_PRODUCT_IMAGE,
        spec: raw.spec || `${bloodType} · ${volumeMl}ml`,
        quantity: 1,
        unitPrice,
        totalPrice: unitPrice,
        testReportCode: '',
        batchNo: '',
        stockManaged: false,
        productType: 'blood_booking',
        species,
        bloodType,
        volumeMl,
      })
      continue
    }

    const product = await getProduct(raw.productId)
    if (!product) return { error: `商品不存在：${raw.productName || raw.productId || ''}` }
    if (product.status !== 'on_sale') return { error: `商品已下架：${product.name}` }
    const city = getCustomerCity(customer)
    if (!isRegionVisible(product, city)) return { error: `该商品在您所在区域暂不销售：${product.name}` }
    if (!isVisibleToCustomer(product, customer)) return { error: `当前客户类型不可购买：${product.name}` }
    if (product.isBloodPack && (customer.customerType !== 'institution' || customer.verificationStatus !== 'approved')) {
      return { error: `血包商品仅限已认证医院客户购买：${product.name}` }
    }
    if (product.productType === 'card_voucher' && customer.role !== 'salesperson') {
      return { error: `卡券商品仅限代理商购买：${product.name}` }
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
      stockManaged: typeof product.stock === 'number',
    })
  }

  return { items, bloodBookingPricing }
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
    const updateRes = await db.collection('user_coupons').where({
      _id: couponId,
      status: 'available',
    }).update({
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

async function getUserIdentity(userId) {
  if (!userId) return {}
  try {
    const { data } = await db.collection('users').doc(userId).get()
    return data || {}
  } catch (_e) {
    return {}
  }
}

async function resolveCommissionPlan(customer, type, bloodBookingPricing, actualAmount, commissionRate) {
  if (type === 'card_order') {
    return {
      salespersonId: customer._id,
      baseAmount: actualAmount,
      amount: roundMoney(actualAmount * commissionRate),
      sourceType: 'order',
    }
  }

  const isPersonalHospitalInviteBooking = (
    type === 'booking' &&
    customer.customerType === 'personal' &&
    bloodBookingPricing &&
    bloodBookingPricing.hospitalReferrerId &&
    Number(bloodBookingPricing.storePrice || 0) > 0
  )

  if (isPersonalHospitalInviteBooking) {
    const hospital = await getUserIdentity(bloodBookingPricing.hospitalReferrerId)
    const salespersonId = hospital.boundSalespersonId || ''
    const baseAmount = roundMoney(bloodBookingPricing.storePrice || 0)
    return {
      salespersonId,
      baseAmount,
      amount: salespersonId ? roundMoney(baseAmount * commissionRate) : 0,
      sourceType: 'hospital_invite_booking',
      hospitalId: hospital._id || bloodBookingPricing.hospitalReferrerId,
      hospitalName: hospital.nickname || hospital.realName || hospital.name || bloodBookingPricing.hospitalReferrerName || '',
    }
  }

  return {
    salespersonId: customer.boundSalespersonId || '',
    baseAmount: actualAmount,
    amount: roundMoney(actualAmount * commissionRate),
    sourceType: 'order',
  }
}

async function reserveStock(items) {
  const reserved = []
  for (const item of items) {
    const quantity = Number(item.quantity || 0)
    if (item.stockManaged === false) continue
    if (quantity <= 0) continue
    const updateRes = await db.collection('products').where({
      _id: item.productId,
      stock: db.command.gte(quantity),
    }).update({
      data: {
        stock: db.command.inc(-quantity),
        updatedAt: formatDateTime(new Date()),
      },
    })
    if (!updateRes.stats || updateRes.stats.updated < 1) {
      for (const reservedItem of reserved) {
        await db.collection('products').doc(reservedItem.productId).update({
          data: {
            stock: db.command.inc(reservedItem.quantity),
            updatedAt: formatDateTime(new Date()),
          },
        })
      }
      return { success: false, error: `库存不足：${item.productName}` }
    }
    reserved.push({ productId: item.productId, quantity })
  }
  return { success: true, reserved }
}

async function releaseCoupon(couponRecord, now) {
  if (!couponRecord || !couponRecord.userCouponId) return
  await db.collection('user_coupons').doc(couponRecord.userCouponId).update({
    data: { status: 'available', usedAt: '', usedOrderId: '', updatedAt: now },
  })
}

async function releasePoints(customerId, pointsDeduction, now) {
  const points = Number(pointsDeduction || 0) * 100
  if (!customerId || points <= 0) return
  await db.collection('users').doc(customerId).update({
    data: {
      'points.balance': db.command.inc(points),
      'points.history': db.command.push({
        id: `pts_refund_${Date.now()}`,
        change: points,
        reason: '订单创建失败返还积分',
        createdAt: now,
      }),
      updatedAt: now,
    },
  })
}

async function clearCustomerCart(customerId, openid, now) {
  if (!customerId) return
  const cartDocId = `cart_${customerId}`
  const data = {
    items: [],
    updatedAt: now,
    clearedByOrderAt: now,
  }
  try {
    await db.collection('carts').doc(cartDocId).update({ data })
  } catch (_e) {
    await db.collection('carts').add({
      data: {
        _id: cartDocId,
        userId: customerId,
        openid,
        ...data,
        createdAt: now,
      },
    })
  }
}

async function getCustomerCart(customerId) {
  if (!customerId) return null
  try {
    const { data } = await db.collection('carts').doc(`cart_${customerId}`).get()
    return data || null
  } catch (_e) {
    return null
  }
}

function cartMatchesOrder(cartItems, orderItems) {
  if (!Array.isArray(cartItems) || !Array.isArray(orderItems)) return false
  if (cartItems.length === 0 || cartItems.length !== orderItems.length) return false
  return orderItems.every((orderItem) => {
    return cartItems.some((cartItem) => (
      cartItem.productId === orderItem.productId &&
      (cartItem.spec || '') === (orderItem.spec || '') &&
      Number(cartItem.quantity || 0) === Number(orderItem.quantity || 0)
    ))
  })
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return error('登录状态无效', 'UNAUTHORIZED')

  // 读取系统配置（佣金率等）
  let commissionRate = 0.2
  let systemConfig = {}
  try {
    const { data: configDoc } = await db.collection('config').doc('system').get()
    systemConfig = configDoc || {}
    if (configDoc && typeof configDoc.commissionRate === 'number') commissionRate = configDoc.commissionRate
  } catch (_e) { /* use default */ }

  const customer = await getCustomer(event.customerId, openid)
  if (!customer) return error('客户不存在或无权下单', 'FORBIDDEN')

  const rawItems = Array.isArray(event.items) ? event.items : []
  if (!rawItems.length) return error('订单商品不能为空')

  const built = await buildOrderItems(rawItems, customer, systemConfig, event.booking || {})
  if (built.error) return error(built.error)

  const type = event.type === 'booking' ? 'booking' : event.type === 'card_voucher' ? 'card_order' : 'normal'
  if (type === 'booking' && (!event.booking || !event.booking.date || !event.booking.location)) {
    return error('请补全预约信息')
  }

  // 卡券订单不需要收货地址
  const defaultAddress = Array.isArray(customer.addresses) ? customer.addresses.find((address) => address.isDefault) : null
  const shippingAddress = type === 'card_order' ? { address: '卡券虚拟发货', name: '', phone: '' } : (event.shippingAddress || defaultAddress)
  if (!shippingAddress) return error('请选择收货地址')

  const totalAmount = built.items.reduce((sum, item) => sum + item.totalPrice, 0)
  let actualAmount = Math.round(totalAmount * 100) / 100
  const now = formatDateTime(new Date())

  // --- 加急费用 ---
  let urgentFee = 0
  let isUrgent = false
  if (event.isUrgent && type === 'booking' && event.booking && event.booking.bloodBooking === true) {
    isUrgent = true
  } else if (event.isUrgent) {
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

  // --- 积分抵扣计划：下单时只记录，支付成功时再实际扣积分 ---
  let pointsDeduction = 0
  let pointsConsumed = 0
  if (event.pointsToUse > 0 && type !== 'recharge') {
    const balance = customer.points?.balance || 0
    const requested = Math.min(Number(event.pointsToUse), balance)
    if (requested >= 100) {
      pointsDeduction = Math.floor(requested / 100)  // 100积分=1元
      actualAmount = Math.max(0.01, Math.round((actualAmount - pointsDeduction) * 100) / 100)
    }
  }

  const initialStatus = type === 'booking' && actualAmount <= 0
    ? 'pending_confirmation'
    : 'pending_payment'
  const paymentStatus = initialStatus === 'pending_payment' ? 'unpaid' : 'not_required'
  const commissionPlan = await resolveCommissionPlan(customer, type, built.bloodBookingPricing, actualAmount, commissionRate)

  const order = {
    orderNo: `DD${Date.now()}`,
    type,
    status: initialStatus,
    customerId: customer._id,
    customerName: customer.nickname || customer.name || customer.phone || '客户',
    customerOpenid: openid,
    salespersonId: commissionPlan.salespersonId || '',
    clerkId: null,
    items: built.items,
    pricing: {
      originalAmount: Math.round(totalAmount * 100) / 100,
      actualAmount,
      priceLog: [],
      shippingFee: 0, urgentFee, pointsDeduction, pointsConsumed, pointsDeductedAt: '', refundedAmount: 0,
      ...(couponRecord ? { coupon: couponRecord } : {}),
    },
    payment: { status: paymentStatus, method: '', paidAt: '', transactionId: '' },
    ...(initialStatus === 'pending_payment' ? { pendingPaymentAt: now } : {}),
    shipping: {
      address: shippingAddress,
      trackingNo: null,
      company: null,
      logistics: [],
      ...(isUrgent ? { urgent: true } : {}),
    },
    ...(type === 'booking' ? { booking: { ...(event.booking || {}), ...(built.bloodBookingPricing || {}) } } : {}),
    returnRecordId: null,
    commission: {
      status: 'pending',
      amount: commissionPlan.amount,
      rate: commissionRate,
      baseAmount: commissionPlan.baseAmount,
      sourceType: commissionPlan.sourceType,
      ...(commissionPlan.hospitalId ? { hospitalId: commissionPlan.hospitalId } : {}),
      ...(commissionPlan.hospitalName ? { hospitalName: commissionPlan.hospitalName } : {}),
      settledAt: null,
    },
    ...(event.remark ? { remark: event.remark } : {}),
    createdAt: now,
    updatedAt: now,
  }

  const stockResult = await reserveStock(built.items)
  if (!stockResult.success) {
    try {
      await releaseCoupon(couponRecord, now)
    } catch (_e) { /* non-critical cleanup */ }
    return error(stockResult.error)
  }

  let _id = ''
  try {
    const addResult = await db.collection('orders').add({ data: order })
    _id = addResult._id
    if (couponRecord && couponRecord.userCouponId) {
      await db.collection('user_coupons').doc(couponRecord.userCouponId).update({
        data: { usedOrderId: _id, updatedAt: now },
      })
    }
  } catch (e) {
    for (const item of (stockResult.reserved || [])) {
      await db.collection('products').doc(item.productId).update({
        data: { stock: db.command.inc(item.quantity), updatedAt: now },
      })
    }
    try {
      await releaseCoupon(couponRecord, now)
    } catch (_e) { /* non-critical cleanup */ }
    return error('订单创建失败，请稍后重试')
  }

  // 生成提成记录
  const currentCart = await getCustomerCart(customer._id)
  const shouldClearCart = event.source === 'cart' || event.fromCart === true || cartMatchesOrder(currentCart?.items, built.items)
  if (shouldClearCart) {
    try {
      await clearCustomerCart(customer._id, openid, now)
    } catch (e) {
      console.error('clear cart after order failed', { customerId: customer._id, orderId: _id, message: e && e.message })
    }
  }

  if (order.salespersonId && order.commission.amount > 0) {
    try {
      const salesperson = await getUserIdentity(order.salespersonId)
      await db.collection('commission_records').add({
        data: {
          salespersonId: order.salespersonId,
          salespersonOpenid: salesperson._openid || salesperson.boundOpenid || '',
          customerId: customer._id,
          orderId: _id,
          orderNo: order.orderNo,
          amount: order.commission.amount,
          commission: order.commission.amount,
          orderAmount: actualAmount,
          commissionBaseAmount: order.commission.baseAmount,
          commissionRate,
          status: 'pending',
          sourceType: order.commission.sourceType || 'order',
          ...(order.commission.hospitalId ? { hospitalId: order.commission.hospitalId } : {}),
          ...(order.commission.hospitalName ? { hospitalName: order.commission.hospitalName } : {}),
          description: `订单 ${order.orderNo} 提成 ¥${order.commission.amount}`,
          createdAt: now,
          updatedAt: now,
        },
      })
    } catch (_e) { /* non-critical */ }
  }

  return { success: true, order: { ...order, id: _id } }
}
