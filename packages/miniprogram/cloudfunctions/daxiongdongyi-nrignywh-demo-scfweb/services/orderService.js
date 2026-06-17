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

function cents(amount) {
  return Math.round(Number(amount || 0) * 100)
}

function yuan(value) {
  return Math.round(Number(value || 0) / 100 * 100) / 100
}

function getActualAmount(order) {
  return order && order.pricing && typeof order.pricing.actualAmount === 'number'
    ? order.pricing.actualAmount
    : 0
}

function getNextStatus(orderType) {
  if (orderType === 'booking') return 'pending_confirmation'
  if (orderType === 'card_order') return 'completed'
  if (orderType === 'recharge') return 'completed'
  return 'pending_shipment'
}

function getPlannedPoints(order) {
  const pricing = order && order.pricing ? order.pricing : {}
  const points = Number(pricing.pointsConsumed || 0)
  if (points > 0) return points
  return Number(pricing.pointsDeduction || 0) * 100
}

async function findOrder(outTradeNo) {
  const { data } = await db.collection('orders').where({
    'payment.outTradeNo': outTradeNo,
  }).limit(1).get()
  return data && data[0] ? data[0] : null
}

async function findReturnByRefundNo(outRefundNo) {
  const { data } = await db.collection('returns').where({
    'refund.outRefundNo': outRefundNo,
  }).limit(1).get()
  return data && data[0] ? data[0] : null
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
    return { success: false, error: '积分余额不足' }
  }
  return { success: true, points }
}

async function creditRecharge(order, actualAmount, paidAt) {
  if (order.type !== 'recharge') return
  const tier = order.rechargeTier || {}
  const credit = (tier.amount || actualAmount) + (tier.bonus || 0)
  if (credit <= 0) return

  await db.collection('users').doc(order.customerId).update({
    data: {
      'wallet.balance': _.inc(credit),
      'wallet.rechargeHistory': _.push({
        id: `rch_${Date.now()}`,
        amount: tier.amount || actualAmount,
        bonus: tier.bonus || 0,
        createdAt: paidAt,
      }),
      updatedAt: paidAt,
    },
  })
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
          'commission.total': _.inc(commissionAmount),
          'commission.available': _.inc(commissionAmount),
          updatedAt: paidAt,
        },
      })
    }
  } catch (_e) {}
}

async function restoreCoupon(order, now) {
  const coupon = order?.pricing?.coupon
  if (!coupon || !coupon.userCouponId || coupon.refundedAt) return
  await db.collection('user_coupons').doc(coupon.userCouponId).update({
    data: { status: 'available', usedAt: '', usedOrderId: '', updatedAt: now },
  })
  await db.collection('orders').doc(order._id).update({
    data: { 'pricing.coupon.refundedAt': now, updatedAt: now },
  })
}

async function restorePoints(order, now) {
  const pricing = order?.pricing || {}
  if (pricing.pointsRefundedAt) return
  const points = pricing.pointsDeductedAt
    ? Number(pricing.pointsConsumed || 0) || Number(pricing.pointsDeduction || 0) * 100
    : 0
  if (!points || points <= 0 || !order.customerId) return
  await db.collection('users').doc(order.customerId).update({
    data: {
      'points.balance': _.inc(points),
      'points.history': _.push({
        id: `pts_return_${Date.now()}`,
        change: points,
        reason: `售后退款退回积分：${order.orderNo || order._id}`,
        relatedOrderId: order._id,
        createdAt: now,
      }),
      updatedAt: now,
    },
  })
  await db.collection('orders').doc(order._id).update({
    data: { 'pricing.pointsRefundedAt': now, updatedAt: now },
  })
}

async function restoreCardVoucher(order, now) {
  const cardUsage = order?.pricing?.cardVoucher || order?.payment?.cardVoucher
  if (!cardUsage || !cardUsage.id || cardUsage.refundedAt) return
  await db.collection('card_vouchers').doc(cardUsage.id).update({
    data: {
      status: 'claimed',
      redeemedOrderId: '',
      redeemedAt: '',
      updatedAt: now,
    },
  })
  await db.collection('orders').doc(order._id).update({
    data: {
      'pricing.cardVoucher.refundedAt': now,
      'payment.cardVoucher.refundedAt': now,
      updatedAt: now,
    },
  })
}

async function deductCommissionAfterRefund(order, returnRecord, now) {
  if (!order?._id || returnRecord?.commissionAdjust?.refundedAt) return
  const refundAmount = Number(returnRecord?.refundAmount || returnRecord?.amount || 0)
  const orderAmount = getActualAmount(order)
  const commissionAmount = order.commission && order.commission.amount || 0
  const deductTarget = orderAmount > 0
    ? Math.min(commissionAmount, Math.round(commissionAmount * Math.min(refundAmount, orderAmount) / orderAmount * 100) / 100)
    : commissionAmount
  if (!deductTarget || deductTarget <= 0) return

  const { data: commissionRecords } = await db.collection('commission_records').where({
    orderId: order._id,
    ...(order.salespersonId ? { salespersonId: order.salespersonId } : {}),
  }).get()
  let deductedAmount = 0
  let balanceDeductedAmount = 0
  for (const cr of (commissionRecords || [])) {
    const amountToDeduct = Math.max(0, Math.min((cr.amount || 0), Math.round((deductTarget - deductedAmount) * 100) / 100))
    if (amountToDeduct <= 0) break
    if (['pending', 'locked', 'settled'].includes(cr.status)) {
      await db.collection('commission_records').doc(cr._id).update({
        data: {
          status: 'deducted',
          deductedAt: now,
          deductedAmount: amountToDeduct,
          deductReason: `售后退款扣回：${returnRecord.afterNo || returnRecord._id}`,
          updatedAt: now,
        },
      })
      deductedAmount += amountToDeduct
      if (cr.status === 'settled') balanceDeductedAmount += amountToDeduct
    } else if (cr.status === 'withdrawn') {
      deductedAmount += amountToDeduct
      balanceDeductedAmount += amountToDeduct
    }
  }

  if (order.salespersonId && balanceDeductedAmount > 0) {
    const { data: salesperson } = await db.collection('users').doc(order.salespersonId).get()
    const available = (salesperson && salesperson.commission && salesperson.commission.available) || 0
    if (available >= balanceDeductedAmount) {
      await db.collection('users').doc(order.salespersonId).update({
        data: {
          'commission.available': _.inc(-balanceDeductedAmount),
          'commission.total': _.inc(-balanceDeductedAmount),
          updatedAt: now,
        },
      })
    } else {
      const remaining = balanceDeductedAmount - available
      await db.collection('users').doc(order.salespersonId).update({
        data: {
          'commission.available': 0,
          'commission.total': _.inc(-balanceDeductedAmount),
          'commission.pendingDeduction': _.inc(remaining),
          updatedAt: now,
        },
      })
    }
  }

  await db.collection('returns').doc(returnRecord._id).update({
    data: {
      'commissionAdjust.amount': deductedAmount,
      'commissionAdjust.reason': deductedAmount > 0 ? `扣回提成 ¥${deductedAmount}` : '无提成需扣回',
      'commissionAdjust.refundedAt': now,
      updatedAt: now,
    },
  })
}

async function completeRefundBusiness(returnRecord, refundResult) {
  if (!returnRecord || returnRecord.refundStatus === 'success' || returnRecord.refund?.status === 'success') return true
  const { data: order } = await db.collection('orders').doc(returnRecord.orderId).get()
  if (!order) return false

  const now = formatDateTime(new Date())
  await restoreCoupon(order, now)
  await restorePoints(order, now)
  await restoreCardVoucher(order, now)
  await deductCommissionAfterRefund(order, returnRecord, now)

  const refundAmount = yuan(Number(refundResult.amount?.refund || refundResult.amount?.payer_refund || 0))
    || Number(returnRecord.refundAmount || returnRecord.amount || 0)

  await db.collection('orders').doc(order._id).update({
    data: {
      'payment.refundStatus': 'success',
      'payment.refundedAt': now,
      'payment.refundId': refundResult.refund_id || refundResult.refundId || '',
      'pricing.refundedAmount': _.inc(refundAmount),
      updatedAt: now,
    },
  })

  await db.collection('returns').doc(returnRecord._id).update({
    data: {
      status: 'return_completed',
      refundStatus: 'success',
      refundCompletedAt: now,
      refund: {
        ...(returnRecord.refund || {}),
        status: 'success',
        refundId: refundResult.refund_id || refundResult.refundId || '',
        successTime: refundResult.success_time || refundResult.successTime || '',
        completedAt: now,
        callback: refundResult,
      },
      timeline: _.push({
        status: 'return_completed',
        title: '售后完成',
        time: now,
        desc: '微信原路退款成功，系统已退回积分、卡券并完成售后单',
      }),
      updatedAt: now,
    },
  })
  return true
}

class OrderService {
  async handlerUnified(params) {
    console.info('[OrderService] unified order created:', params.out_trade_no)
    return true
  }

  async handlerUnifiedTrigger(params) {
    const outTradeNo = params.out_trade_no || params.outTradeNo
    const tradeState = params.trade_state || params.tradeState
    if (!outTradeNo || tradeState !== 'SUCCESS') return true

    const order = await findOrder(outTradeNo)
    if (!order) {
      console.error('[OrderService] order not found:', outTradeNo)
      return false
    }

    if (order.payment && order.payment.status === 'paid') return true
    if (order.status !== 'pending_payment') {
      console.error('[OrderService] invalid order status:', outTradeNo, order.status)
      return false
    }

    const actualAmount = getActualAmount(order)
    const paidCents = Number(params.amount?.payer_total || params.amount?.total || 0)
    if (paidCents !== cents(actualAmount)) {
      console.error('[OrderService] amount mismatch:', outTradeNo, paidCents, cents(actualAmount))
      return false
    }

    const paidAt = formatDateTime(new Date())
    const nextStatus = getNextStatus(order.type)
    const pointsResult = await deductPointsIfNeeded(order, paidAt)
    if (!pointsResult.success) {
      console.error('[OrderService] points deduction failed:', outTradeNo, pointsResult.error)
      return false
    }

    await db.collection('orders').doc(order._id).update({
      data: {
        status: nextStatus,
        payment: {
          ...(order.payment || {}),
          status: 'paid',
          method: 'wechat',
          paidAt,
          transactionId: params.transaction_id || params.transactionId || outTradeNo,
          amount: actualAmount,
          totalFee: paidCents,
        },
        ...(pointsResult.points ? { 'pricing.pointsConsumed': pointsResult.points, 'pricing.pointsDeductedAt': paidAt } : {}),
        ...(order.type !== 'recharge' ? { 'commission.status': 'locked' } : {}),
        updatedAt: paidAt,
      },
    })

    await creditRecharge(order, actualAmount, paidAt)
    await settleCommission(order, nextStatus, paidAt)
    return true
  }

  async handlerRefund(params) {
    console.info('[OrderService] refund accepted:', params.out_refund_no)
    return true
  }

  async handlerRefundTrigger(params) {
    console.info('[OrderService] refund result:', params.out_refund_no, params.refund_status)
    const outRefundNo = params.out_refund_no || params.outRefundNo
    const refundStatus = params.refund_status || params.refundStatus || params.status
    if (!outRefundNo) return true

    const returnRecord = await findReturnByRefundNo(outRefundNo)
    if (!returnRecord) {
      console.error('[OrderService] return record not found for refund:', outRefundNo)
      return false
    }

    if (refundStatus === 'SUCCESS') {
      return completeRefundBusiness(returnRecord, params)
    }

    if (refundStatus === 'ABNORMAL' || refundStatus === 'CLOSED') {
      const now = formatDateTime(new Date())
      await db.collection('returns').doc(returnRecord._id).update({
        data: {
          refundStatus: refundStatus === 'CLOSED' ? 'closed' : 'abnormal',
          refund: {
            ...(returnRecord.refund || {}),
            status: refundStatus === 'CLOSED' ? 'closed' : 'abnormal',
            callback: params,
            updatedAt: now,
          },
          updatedAt: now,
        },
      })
      if (returnRecord.orderId) {
        await db.collection('orders').doc(returnRecord.orderId).update({
          data: {
            'payment.refundStatus': refundStatus === 'CLOSED' ? 'closed' : 'abnormal',
            updatedAt: now,
          },
        })
      }
    }
    return true
  }

  async handlerTransfer(params, result) {
    console.info('[OrderService] transfer accepted:', params.out_bill_no, result?.transfer_bill_no)
    return true
  }

  async handlerTransferTrigger(params) {
    console.info('[OrderService] transfer result:', params.out_bill_no, params.state)
    return true
  }
}

module.exports = OrderService
