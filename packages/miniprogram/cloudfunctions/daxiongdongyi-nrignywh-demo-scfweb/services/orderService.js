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
