const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateTime(date) {
  return `${formatDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function getActualAmount(order) {
  return order && order.pricing && typeof order.pricing.actualAmount === 'number'
    ? order.pricing.actualAmount
    : 0
}

function getExpectedPayAmount(order) {
  return order && order.payment && typeof order.payment.amount === 'number'
    ? order.payment.amount
    : getActualAmount(order)
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

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function getPlannedPoints(order) {
  const pricing = order && order.pricing ? order.pricing : {}
  const points = Number(pricing.pointsConsumed || 0)
  if (points > 0) return points
  return Number(pricing.pointsDeduction || 0) * 100
}

function pickPayload(event) {
  if (event && event.payment) return event.payment
  if (event && event.data) return event.data
  return event || {}
}

function getOutTradeNo(payload) {
  return payload.out_trade_no || payload.outTradeNo || payload.OutTradeNo || ''
}

function getTransactionId(payload) {
  return payload.transaction_id || payload.transactionId || payload.TransactionId || ''
}

function getTotalFee(payload) {
  const value = payload.total_fee ?? payload.totalFee ?? payload.TotalFee
  return Number(value || 0)
}

function isPaySuccess(payload) {
  const returnCode = payload.return_code || payload.returnCode || payload.ReturnCode
  const resultCode = payload.result_code || payload.resultCode || payload.ResultCode
  const tradeState = payload.trade_state || payload.tradeState || payload.TradeState
  if (tradeState) return tradeState === 'SUCCESS'
  if (returnCode || resultCode) return returnCode === 'SUCCESS' && resultCode === 'SUCCESS'
  return Boolean(getTransactionId(payload))
}

async function findOrder(outTradeNo) {
  const { data } = await db.collection('orders').where({
    'payment.outTradeNo': outTradeNo,
  }).limit(1).get()
  return data && data[0] ? data[0] : null
}

async function settleCommission(order, nextStatus, paidAt) {
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

  if (nextStatus !== 'completed' || !order.salespersonId) return

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

async function creditRecharge(order, actualAmount, paidAt) {
  if (order.type !== 'recharge') return
  const tier = order.rechargeTier || {}
  const credit = (tier.amount || actualAmount) + (tier.bonus || 0)
  if (credit <= 0) return
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
    },
  })
}

async function redeemCardVoucher(order, paidAt) {
  const cardUsage = order.payment && order.payment.cardVoucher
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
  if (!card) return { success: false, error: 'card not found' }
  if (card.status !== 'ungifted') return { success: false, error: 'card unavailable' }
  if (card.purchaserId && card.purchaserId !== order.customerId) return { success: false, error: 'card sold' }
  if (card.purchaseOrderId && card.purchaseOrderId !== order._id) return { success: false, error: 'card locked' }

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
    return { success: false, error: 'insufficient points' }
  }
  return { success: true, points }
}

exports.main = async (event) => {
  const payload = pickPayload(event)
  const outTradeNo = getOutTradeNo(payload)

  if (!outTradeNo || !isPaySuccess(payload)) {
    return { errcode: 1, errmsg: 'payment not successful' }
  }

  const order = await findOrder(outTradeNo)
  if (!order) return { errcode: 1, errmsg: 'order not found' }

  const actualAmount = getExpectedPayAmount(order)
  if (getTotalFee(payload) !== cents(actualAmount)) {
    return { errcode: 1, errmsg: 'amount mismatch' }
  }

  if (order.payment && order.payment.status === 'paid') {
    const paidAt = order.payment.paidAt || formatDateTime(new Date())
    const cardPurchaseResult = await fulfillCardPurchase(order, paidAt)
    if (!cardPurchaseResult.success) {
      return { errcode: 1, errmsg: cardPurchaseResult.error || 'card purchase failed' }
    }
    await lockBloodCommission(order, paidAt)
    return { errcode: 0, errmsg: 'ok' }
  }

  if (order.status !== 'pending_payment') {
    return { errcode: 1, errmsg: 'invalid order status' }
  }

  const paidAt = formatDateTime(new Date())
  const nextStatus = getNextStatus(order.type)
  const transactionId = getTransactionId(payload) || outTradeNo
  const pointsResult = await deductPointsIfNeeded(order, paidAt)
  if (!pointsResult.success) {
    return { errcode: 1, errmsg: pointsResult.error || 'points deduction failed' }
  }
  const cardPurchaseResult = await fulfillCardPurchase(order, paidAt)
  if (!cardPurchaseResult.success) {
    return { errcode: 1, errmsg: cardPurchaseResult.error || 'card purchase failed' }
  }

  await db.collection('orders').doc(order._id).update({
    data: {
      status: nextStatus,
      payment: {
        ...(order.payment || {}),
        status: 'paid',
        method: 'wechat',
        paidAt,
        transactionId,
        amount: actualAmount,
        totalFee: getTotalFee(payload),
      },
      ...(pointsResult.points ? { 'pricing.pointsConsumed': pointsResult.points, 'pricing.pointsDeductedAt': paidAt } : {}),
      ...(order.type !== 'recharge' && order.type !== 'card_order' ? { 'commission.status': 'locked' } : {}),
      updatedAt: paidAt,
    },
  })

  await redeemCardVoucher(order, paidAt)
  await creditRecharge(order, actualAmount, paidAt)
  await settleCommission(order, nextStatus, paidAt)
  await lockBloodCommission(order, paidAt)

  return { errcode: 0, errmsg: 'ok' }
}
