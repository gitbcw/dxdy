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

function isOwner(order, openid) {
  if (order.customerOpenid) return order.customerOpenid === openid
  return order._openid === openid
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return error('登录状态无效', 'UNAUTHORIZED')

  const order = await getOrder(event.orderId)
  if (!order) return error('订单不存在', 'NOT_FOUND')
  if (!isOwner(order, openid)) return error('只能支付自己的订单', 'FORBIDDEN')
  if (order.status !== 'pending_payment') return error('仅待支付订单可支付', 'INVALID_STATUS', { ...order, id: order._id })

  const actualAmount = order.pricing && typeof order.pricing.actualAmount === 'number'
    ? order.pricing.actualAmount
    : 0
  if (actualAmount <= 0) return error('订单金额异常')

  const method = ['wechat', 'wallet', 'offline'].includes(event.method) ? event.method : 'wechat'
  const paidAt = formatDateTime(new Date())
  const nextStatus = order.type === 'booking' ? 'pending_confirmation'
    : order.type === 'card_order' ? 'completed'
    : order.type === 'recharge' ? 'completed'
    : 'pending_shipment'
  const transactionId = `PAY${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`

  // 钱包支付：先扣款再更新订单
  if (method === 'wallet' && order.type !== 'recharge') {
    try {
      const { data: userDoc } = await db.collection('users').doc(order.customerId).get()
      if (!userDoc || (userDoc.wallet?.balance || 0) < actualAmount) {
        return error('钱包余额不足', 'INSUFFICIENT_BALANCE')
      }
      await db.collection('users').doc(order.customerId).update({
        data: {
          'wallet.balance': db.command.inc(-actualAmount),
          updatedAt: paidAt,
        }
      })
    } catch (_e) {
      return error('钱包扣款失败', 'WALLET_ERROR')
    }
  }

  await db.collection('orders').doc(order._id).update({
    data: {
      status: nextStatus,
      payment: {
        status: 'paid',
        method,
        paidAt,
        transactionId,
        amount: actualAmount,
      },
      ...(order.type !== 'recharge' ? { 'commission.status': 'locked' } : {}),
      updatedAt: paidAt,
    },
  })

  // 充值订单：增加钱包余额
  if (order.type === 'recharge') {
    let updatedUser = null
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
        if (data) {
          const { _id, ...rest } = data
          updatedUser = { id: _id, ...rest }
        }
      }
    } catch (_e) {
      return error('钱包余额更新失败', 'WALLET_CREDIT_FAILED')
    }

    const updated = await getOrder(order._id)
    return { success: true, order: { ...updated, id: updated._id }, user: updatedUser }
  }

  // 锁定对应的提成记录
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
  } catch (_e) { /* non-critical */ }

  // 卡券订单：支付即完成，立即结算佣金
  if (nextStatus === 'completed' && order.salespersonId) {
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
      // 更新代理商余额
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
    } catch (_e) { /* non-critical */ }
  }

  const updated = await getOrder(order._id)
  return { success: true, order: { ...updated, id: updated._id } }
}
