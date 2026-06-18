const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const PAY_ENV_ID = process.env.WECHAT_PAY_ENV_ID || process.env.TCB_ENV || 'cloud1-d7g7ctn4m86bada89'
const PAY_NOTIFY_FUNCTION = process.env.WECHAT_PAY_NOTIFY_FUNCTION || 'payNotify'
const PAY_MCH_ID = process.env.WECHAT_PAY_MCH_ID || '1640995667'

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateTime(date) {
  return `${formatDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function error(message, code = 'BAD_REQUEST', order = null) {
  return { success: false, code, error: message, ...(order ? { order } : {}) }
}

async function getOrder(orderId) {
  if (!orderId) return null
  try {
    const { data } = await db.collection('orders').doc(orderId).get()
    return data || null
  } catch (e) {
    return null
  }
}

async function getSystemConfig() {
  try {
    const { data } = await db.collection('config').doc('system').get()
    return data || {}
  } catch (_e) {
    return {}
  }
}

async function getSystemOperator() {
  const { data } = await db.collection('users').where({
    role: _.in(['system_admin', 'admin']),
    status: _.neq('disabled'),
  }).limit(1).get()
  return data && data[0] ? data[0] : null
}

function parseDate(value) {
  if (!value) return null
  const text = String(value).trim()
  if (!text) return null
  const date = new Date(text.includes('T') ? text : text.replace(' ', 'T'))
  if (!Number.isNaN(date.getTime())) return date
  const fallback = new Date(text.replace(/-/g, '/'))
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

function getPendingPaymentBaseTime(order) {
  return parseDate(order?.pendingPaymentAt)
    || parseDate(order?.confirmedAt)
    || parseDate(order?.createdAt)
}

async function cancelIfPaymentExpired(order) {
  const config = await getSystemConfig()
  const minutes = Math.max(0, Number(config.paymentTimeoutMinutes || 30))
  if (!minutes) return { expired: false }
  const baseTime = getPendingPaymentBaseTime(order)
  if (!baseTime) return { expired: false }
  if (Date.now() - baseTime.getTime() <= minutes * 60 * 1000) return { expired: false }

  const operator = await getSystemOperator()
  if (operator) {
    await cloud.callFunction({
      name: 'updateOrderStatus',
      data: {
        orderId: order._id,
        status: 'cancelled',
        operatorId: operator._id,
        operatorName: '系统自动取消',
        autoCancel: true,
      },
    })
  }
  return { expired: true, minutes }
}

function isOwner(order, openid) {
  if (order.customerOpenid) return order.customerOpenid === openid
  return order._openid === openid
}

function getActualAmount(order) {
  return order && order.pricing && typeof order.pricing.actualAmount === 'number'
    ? order.pricing.actualAmount
    : 0
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function getCardAmount(card) {
  return roundMoney(card && (card.deductionAmount || card.discountAmount || card.amount || 0))
}

function getNextStatus(orderType) {
  if (orderType === 'booking') return 'pending_confirmation'
  if (orderType === 'card_order') return 'completed'
  if (orderType === 'recharge') return 'completed'
  return 'pending_shipment'
}

function cents(amount) {
  return Math.round(Number(amount || 0) * 100)
}

function buildOutTradeNo(order) {
  // 微信订单中心跳转时会把 out_trade_no 作为商品订单号回传，
  // 订单详情页使用 id（即 _id）查询，所以 out_trade_no 直接用 _id，
  // 保证订单中心能闭环跳转回小程序订单详情页。
  return String(order._id || order.orderNo || Date.now()).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32)
}

function buildPaymentDescription(order) {
  if (order.type === 'recharge') return '大熊动医-钱包充值'
  const items = order.items || []
  if (!items.length) return '大熊动医-订单支付'
  const firstName = String(items[0].productName || '').trim()
  if (!firstName) return '大熊动医-订单支付'
  if (items.length === 1) return `大熊动医-${firstName}`.slice(0, 127)
  return `大熊动医-${firstName}等${items.length}件商品`.slice(0, 127)
}

function normalizeUser(user) {
  if (!user) return null
  const { _id, ...rest } = user
  return { id: _id, ...rest }
}

function getPlannedPoints(order) {
  const pricing = order && order.pricing ? order.pricing : {}
  const points = Number(pricing.pointsConsumed || 0)
  if (points > 0) return points
  return Number(pricing.pointsDeduction || 0) * 100
}

async function getUpdatedCustomer(customerId) {
  const { data } = await db.collection('users').doc(customerId).get()
  return normalizeUser(data)
}

async function resolveCardVoucher(order, cardVoucherId, now) {
  const id = String(cardVoucherId || '').trim()
  if (!id) return null
  if (order.type !== 'booking') return error('仅预约订单支持使用卡券抵扣', 'INVALID_CARD_VOUCHER')
  const { data: card } = await db.collection('card_vouchers').doc(id).get()
  if (!card) return error('卡券不存在', 'CARD_NOT_FOUND')
  if (card.status !== 'claimed') return error('该卡券当前不可使用', 'CARD_UNAVAILABLE')
  if (card.currentHolderId !== order.customerId) return error('只能使用本人持有的卡券', 'CARD_FORBIDDEN')
  if (card.expiresAt && card.expiresAt < now) {
    await db.collection('card_vouchers').doc(id).update({ data: { status: 'expired', updatedAt: now } })
    return error('卡券已过期', 'CARD_EXPIRED')
  }
  const discountAmount = Math.min(getCardAmount(card), getActualAmount(order))
  if (discountAmount <= 0) return error('卡券抵扣金额无效', 'CARD_AMOUNT_INVALID')
  return {
    id,
    cardNo: card.cardNo,
    productName: card.productName || '卡券抵扣',
    discountAmount,
  }
}

async function redeemCardVoucher(order, cardUsage, paidAt) {
  if (!cardUsage || !cardUsage.id) return
  await db.collection('card_vouchers').doc(cardUsage.id).update({
    data: {
      status: 'redeemed',
      redeemedOrderId: order._id,
      redeemedAt: paidAt,
      updatedAt: paidAt,
    },
  })
}

async function fulfillCardPurchase(order, paidAt) {
  if (order.type !== 'card_order' || !order.cardVoucherId) return { success: true }
  const { data: card } = await db.collection('card_vouchers').doc(order.cardVoucherId).get()
  if (!card) return error('卡券不存在', 'CARD_NOT_FOUND')
  if (card.status !== 'ungifted') return error('该卡券当前不可购买', 'CARD_UNAVAILABLE')
  if (card.purchaserId && card.purchaserId !== order.customerId) return error('该卡券已被购买', 'CARD_SOLD')
  if (card.purchaseOrderId && card.purchaseOrderId !== order._id) return error('该卡券已被其他订单锁定', 'CARD_LOCKED')

  await db.collection('card_vouchers').doc(order.cardVoucherId).update({
    data: {
      purchaseOrderId: order._id,
      purchaseOrderNo: order.orderNo || '',
      purchaserId: order.customerId,
      purchaserName: order.customerName || '',
      purchaserOpenid: order.customerOpenid || '',
      currentHolderId: null,
      currentHolderName: '',
      updatedAt: paidAt,
    },
  })
  return { success: true }
}

async function deductPointsIfNeeded(order, paidAt) {
  const points = getPlannedPoints(order)
  if (!points || points <= 0 || order.pricing?.pointsDeductedAt) return { success: true }
  const updateRes = await db.collection('users').where({
    _id: order.customerId,
    'points.balance': _.gte(points),
  }).update({
    data: {
      'points.balance': _.inc(-points),
      'points.history': _.push({
        id: `pts_${Date.now()}`,
        change: -points,
        reason: '订单积分抵扣',
        relatedOrderId: order._id,
        createdAt: paidAt,
      }),
      updatedAt: paidAt,
    },
  })
  if (!updateRes.stats || updateRes.stats.updated < 1) {
    return error('积分余额不足，请重新提交订单', 'INSUFFICIENT_POINTS')
  }
  await db.collection('orders').doc(order._id).update({
    data: {
      'pricing.pointsConsumed': points,
      'pricing.pointsDeductedAt': paidAt,
      updatedAt: paidAt,
    },
  })
  return { success: true, points }
}

async function rollbackPoints(order, points, paidAt) {
  if (!points || points <= 0) return
  await db.collection('users').doc(order.customerId).update({
    data: {
      'points.balance': _.inc(points),
      'points.history': _.push({
        id: `pts_rollback_${Date.now()}`,
        change: points,
        reason: '支付失败返还积分',
        relatedOrderId: order._id,
        createdAt: paidAt,
      }),
      updatedAt: paidAt,
    },
  })
  await db.collection('orders').doc(order._id).update({
    data: {
      'pricing.pointsDeductedAt': '',
      updatedAt: paidAt,
    },
  })
}

async function payWithWallet(order, actualAmount, paidAt) {
  try {
    const updateRes = await db.collection('users').where({
      _id: order.customerId,
      'wallet.balance': _.gte(actualAmount),
    }).update({
      data: {
        'wallet.balance': _.inc(-actualAmount),
        updatedAt: paidAt,
      },
    })
    if (!updateRes.stats || updateRes.stats.updated < 1) {
      return error('钱包余额不足', 'INSUFFICIENT_BALANCE')
    }
    return { success: true }
  } catch (_e) {
    return error('钱包扣款失败', 'WALLET_ERROR')
  }
}

async function lockBloodCommission(order, paidAt) {
  const booking = order.booking || {}
  const amount = roundMoney(booking.hospitalCommissionAmount || 0)
  const hospitalId = booking.hospitalReferrerId || ''
  if (order.type !== 'booking' || !hospitalId || amount <= 0) return

  const payload = {
    hospitalId,
    hospitalName: booking.hospitalReferrerName || '',
    customerId: order.customerId,
    customerName: order.customerName || '',
    orderId: order._id,
    orderNo: order.orderNo || '',
    amount,
    storePrice: roundMoney(booking.storePrice || 0),
    retailPrice: roundMoney(booking.retailPrice || 0),
    status: 'locked',
    sourceType: 'blood_booking',
    lockedAt: paidAt,
    updatedAt: paidAt,
  }

  const { data } = await db.collection('blood_commission_records').where({
    orderId: order._id,
    sourceType: 'blood_booking',
  }).limit(1).get()
  if (data && data[0]) {
    await db.collection('blood_commission_records').doc(data[0]._id).update({ data: payload })
  } else {
    await db.collection('blood_commission_records').add({
      data: { ...payload, createdAt: paidAt },
    })
  }

  await db.collection('orders').doc(order._id).update({
    data: {
      'booking.hospitalCommissionStatus': 'locked',
      updatedAt: paidAt,
    },
  })
}

async function markPaid(order, method, actualAmount, cardUsage = null) {
  const paidAt = formatDateTime(new Date())
  const nextStatus = getNextStatus(order.type)
  const transactionId = `PAY${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  let updatedUser = null

  const pointsResult = await deductPointsIfNeeded(order, paidAt)
  if (!pointsResult.success) return pointsResult

  if (method === 'wallet' && order.type !== 'recharge') {
    const walletResult = await payWithWallet(order, actualAmount, paidAt)
    if (!walletResult.success) {
      await rollbackPoints(order, pointsResult.points, paidAt)
      return walletResult
    }
  }

  await redeemCardVoucher(order, cardUsage, paidAt)
  const cardPurchaseResult = await fulfillCardPurchase(order, paidAt)
  if (!cardPurchaseResult.success) return cardPurchaseResult

  await db.collection('orders').doc(order._id).update({
    data: {
      status: nextStatus,
      payment: {
        status: 'paid',
        method: actualAmount <= 0 && cardUsage ? 'card_voucher' : method,
        paidAt,
        transactionId,
        amount: actualAmount,
        ...(cardUsage ? { cardVoucher: cardUsage } : {}),
      },
      ...(cardUsage ? {
        'pricing.cardVoucherDiscount': cardUsage.discountAmount,
        'pricing.cardVoucher': cardUsage,
      } : {}),
      ...(order.type !== 'recharge' && order.type !== 'card_order' ? { 'commission.status': 'locked' } : {}),
      updatedAt: paidAt,
    },
  })

  if (order.type === 'recharge') {
    try {
      const tier = order.rechargeTier || {}
      const credit = (tier.amount || actualAmount) + (tier.bonus || 0)
      if (credit > 0) {
        await db.collection('users').doc(order.customerId).update({
          data: {
            'wallet.balance': db.command.inc(credit),
            'wallet.rechargeHistory': db.command.push({
              id: `rch_${Date.now()}`,
              amount: tier.amount || actualAmount,
              bonus: tier.bonus || 0,
              createdAt: paidAt,
            }),
            updatedAt: paidAt,
          }
        })
        const { data } = await db.collection('users').doc(order.customerId).get()
        updatedUser = normalizeUser(data)
      }
    } catch (_e) {
      return error('钱包余额更新失败', 'WALLET_CREDIT_FAILED')
    }
  }

  try {
    const { data: pendingRecords } = await db.collection('commission_records').where({
      orderId: order._id,
      status: 'pending',
    }).get()
    for (const rec of (pendingRecords || [])) {
      await db.collection('commission_records').doc(rec._id).update({
        data: { status: 'locked', lockedAt: paidAt, updatedAt: paidAt },
      })
    }
  } catch (_e) {}

  try {
    await lockBloodCommission(order, paidAt)
  } catch (_e) {}

  if (nextStatus === 'completed' && order.type !== 'card_order' && order.salespersonId) {
    try {
      const { data: commissionRecords } = await db.collection('commission_records').where({
        orderId: order._id,
        status: 'locked',
      }).get()
      for (const rec of (commissionRecords || [])) {
        await db.collection('commission_records').doc(rec._id).update({
          data: { status: 'settled', settledAt: paidAt, updatedAt: paidAt },
        })
      }
      const commissionAmount = (commissionRecords || []).reduce((sum, r) => sum + (r.amount || 0), 0)
      if (commissionAmount > 0) {
        await db.collection('users').doc(order.salespersonId).update({
          data: {
            'commission.total': db.command.inc(commissionAmount),
            'commission.available': db.command.inc(commissionAmount),
            updatedAt: paidAt,
          },
        })
      }
    } catch (_e) {}
  }

  const updated = await getOrder(order._id)
  updatedUser = updatedUser || await getUpdatedCustomer(order.customerId)
  return { success: true, order: { ...updated, id: updated._id }, user: updatedUser }
}

async function createWechatPayment(order, actualAmount, openid, cardUsage = null) {
  if (!PAY_MCH_ID) return error('微信支付商户号未配置', 'PAY_CONFIG_MISSING')

  const outTradeNo = buildOutTradeNo(order)
  const body = buildPaymentDescription(order)
  const totalFee = cents(actualAmount)

  await db.collection('orders').doc(order._id).update({
    data: {
      payment: {
        ...(order.payment || {}),
        status: 'pending',
        method: 'wechat',
        outTradeNo,
        amount: actualAmount,
        totalFee,
        ...(cardUsage ? { cardVoucher: cardUsage } : {}),
        prepayCreatedAt: formatDateTime(new Date()),
      },
      ...(cardUsage ? {
        'pricing.cardVoucherDiscount': cardUsage.discountAmount,
        'pricing.cardVoucher': cardUsage,
      } : {}),
      updatedAt: formatDateTime(new Date()),
    },
  })

  return {
    success: true,
    payRequest: {
      description: body,
      out_trade_no: outTradeNo,
      amount: { total: totalFee, currency: 'CNY' },
    },
    outTradeNo,
    order: { ...order, id: order._id, payment: { ...(order.payment || {}), status: 'pending', method: 'wechat', outTradeNo, amount: actualAmount, totalFee, ...(cardUsage ? { cardVoucher: cardUsage } : {}) } },
    openid,
  }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return error('登录状态无效', 'UNAUTHORIZED')

  const order = await getOrder(event.orderId)
  if (!order) return error('订单不存在', 'NOT_FOUND')
  if (!isOwner(order, openid)) return error('只能支付自己的订单', 'FORBIDDEN')
  if (order.status !== 'pending_payment') return error('仅待支付订单可支付', 'INVALID_STATUS', { ...order, id: order._id })

  const timeoutResult = await cancelIfPaymentExpired(order)
  if (timeoutResult.expired) {
    const latest = await getOrder(order._id)
    return error('订单支付超时，已自动取消', 'PAYMENT_TIMEOUT', latest ? { ...latest, id: latest._id } : { ...order, id: order._id, status: 'cancelled' })
  }

  const originalAmount = getActualAmount(order)
  if (originalAmount <= 0) return error('订单金额异常')

  const now = formatDateTime(new Date())
  const cardResult = await resolveCardVoucher(order, event.cardVoucherId, now)
  if (cardResult && cardResult.success === false) return cardResult
  const cardUsage = cardResult || null
  const actualAmount = roundMoney(originalAmount - (cardUsage ? cardUsage.discountAmount : 0))

  const method = ['wechat', 'wallet', 'offline', 'card_voucher'].includes(event.method) ? event.method : 'wechat'
  if (actualAmount <= 0 && cardUsage) return markPaid(order, 'card_voucher', 0, cardUsage)
  if (method === 'card_voucher') return error('卡券抵扣后仍有待支付金额，请选择微信或钱包支付')
  if (method === 'wechat') return createWechatPayment(order, actualAmount, openid, cardUsage)
  return markPaid(order, method, actualAmount, cardUsage)
}
