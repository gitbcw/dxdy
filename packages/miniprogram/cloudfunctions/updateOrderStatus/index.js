const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

function formatBeijingLogTime(date = new Date()) {
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const y = beijing.getUTCFullYear()
  const m = String(beijing.getUTCMonth() + 1).padStart(2, '0')
  const d = String(beijing.getUTCDate()).padStart(2, '0')
  const h = String(beijing.getUTCHours()).padStart(2, '0')
  const min = String(beijing.getUTCMinutes()).padStart(2, '0')
  const s = String(beijing.getUTCSeconds()).padStart(2, '0')
  return y + '-' + m + '-' + d + ' ' + h + ':' + min + ':' + s + '+08:00'
}
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

function error(message, code = 'BAD_REQUEST') {
  return { success: false, code, error: message }
}

function getStatusText(status) {
  const map = {
    pending_payment: '待付款',
    pending_shipment: '待发货',
    pending_receipt: '待收货',
    completed: '已完成',
    cancelled: '已取消',
    preparing: '备货中',
    pending_confirmation: '待确认',
    confirmed: '已确认',
    in_service: '服务中',
  }
  return map[status] || status
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

async function getCurrentUser(openid, operatorId) {
  if (!openid && operatorId) {
    try {
      const { data: user } = await db.collection('users').doc(operatorId).get()
      return user || null
    } catch (e) {
      return null
    }
  }

  const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
  if (data && data.length) return data[0]

  const { data: boundUsers } = await db.collection('users').where({ boundOpenid: openid }).limit(1).get()
  if (boundUsers && boundUsers.length) return boundUsers[0]

  if (!operatorId) return null
  try {
    const { data: user } = await db.collection('users').doc(operatorId).get()
    if (!user) return null
    if (user._openid && user._openid !== openid) return null
    if (user.boundOpenid && user.boundOpenid !== openid) return null
    await db.collection('users').doc(user._id).update({
      data: { boundOpenid: openid, updatedAt: formatDateTime(new Date()) },
    })
    return { ...user, boundOpenid: openid }
  } catch (e) {
    return null
  }
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

function addDays(date, days) {
  const next = new Date(date.getTime())
  next.setDate(next.getDate() + days)
  return next
}

async function releaseOrderAssets(order, now) {
  for (const item of (order.items || [])) {
    const quantity = Number(item.quantity || 0)
    if (item.stockManaged === false) continue
    if (item.productId && quantity > 0) {
      await db.collection('products').doc(item.productId).update({
        data: { stock: db.command.inc(quantity), updatedAt: now },
      })
    }
  }

  const coupon = order.pricing && order.pricing.coupon
  if (coupon && coupon.userCouponId) {
    await db.collection('user_coupons').doc(coupon.userCouponId).update({
      data: { status: 'available', usedAt: '', usedOrderId: '', updatedAt: now },
    })
  }

  const pricing = order.pricing || {}
  const points = pricing.pointsDeductedAt
    ? Number(pricing.pointsConsumed || 0) || Number(pricing.pointsDeduction || 0) * 100
    : 0
  if (points > 0 && order.customerId) {
    await db.collection('users').doc(order.customerId).update({
      data: {
        'points.balance': db.command.inc(points),
        'points.history': db.command.push({
          id: `pts_refund_${Date.now()}`,
          change: points,
          reason: '订单取消返还积分',
          createdAt: now,
        }),
        updatedAt: now,
      },
    })
    await db.collection('orders').doc(order._id).update({
      data: {
        'pricing.pointsDeductedAt': '',
        updatedAt: now,
      },
    })
  }

  if (order.type === 'card_order') {
    const { data: cards } = await db.collection('card_vouchers').where({
      purchaseOrderId: order._id,
      status: _.in(['ungifted', 'gifted', 'claimed']),
    }).get()
    for (const card of (cards || [])) {
      await db.collection('card_vouchers').doc(card._id).update({
        data: {
          status: 'voided',
          voidedAt: now,
          voidedBy: 'order_cancelled',
          voidReason: '订单取消自动作废',
          updatedAt: now,
        },
      })
    }
  }

  await db.collection('commission_records').where({
    orderId: order._id,
    status: _.in(['pending', 'locked']),
  }).update({
    data: { status: 'cancelled', cancelledAt: now, updatedAt: now },
  })
}

function isOwner(order, openid, user) {
  if (order.customerOpenid) return order.customerOpenid === openid
  if (order._openid) return order._openid === openid
  return user && order.customerId === user._id
}

function isStaff(user) {
  return ['admin', 'system_admin', 'service'].includes(user && user.role)
}

function canClerkPrepare(order, status, user) {
  if (!user || user.role !== 'clerk') return false
  if (status !== 'preparing') return false
  if (!['pending_shipment', 'confirmed'].includes(order.status)) return false
  return !order.clerkId || order.clerkId === user._id
}

function canTransition(order, status, user, openid) {
  if (canClerkPrepare(order, status, user)) return true
  if (isOwner(order, openid, user)) {
    if (status === 'cancelled') return order.status === 'pending_payment'
    if (status === 'completed') return order.status === 'pending_receipt'
  }

  if (!isStaff(user)) return false
  const allowed = {
    pending_payment: ['cancelled'],
    pending_confirmation: ['confirmed', 'cancelled'],
    confirmed: ['cancelled'],
    pending_shipment: ['preparing', 'cancelled'],
    preparing: ['cancelled'],
    pending_receipt: ['completed'],
  }
  return (allowed[order.status] || []).includes(status)
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''

  const orderId = String(event.orderId || '').trim()
  const status = String(event.status || '').trim()
  if (!orderId) return error('订单参数缺失')
  if (!status) return error('状态参数缺失')
  if (!openid && !String(event.operatorId || '').trim()) return error('登录状态无效', 'UNAUTHORIZED')

  const user = await getCurrentUser(openid, String(event.operatorId || '').trim())
  if (!user) return error('当前账号未绑定业务用户', 'FORBIDDEN')

  const order = await getOrder(orderId)
  if (!order) return error('订单不存在', 'NOT_FOUND')
  if (!canTransition(order, status, user, openid)) return error('当前订单状态不可执行该操作', 'INVALID_STATUS')

  const now = formatDateTime(new Date())
  const config = await getSystemConfig()
  const commissionLockDays = Math.max(0, Number(config.commissionLockDays || 0))
  const settlementEligibleAt = status === 'completed' && commissionLockDays > 0
    ? formatDateTime(addDays(new Date(), commissionLockDays))
    : ''
  const updateData = { status, updatedAt: now }

  if (order.type === 'booking' && order.status === 'pending_confirmation' && status === 'confirmed') {
    const alreadyPaid = order.payment?.status === 'paid'
    const hasConfirmedAmount = roundMoney(order.pricing?.actualAmount) > 0
    if (alreadyPaid && hasConfirmedAmount) {
      updateData.serviceConfirmedAt = now
      updateData.serviceConfirmedBy = user._id
    } else {
    const bookingAmount = roundMoney(event.bookingAmount)
    const urgentFee = order.booking?.urgent || order.shipping?.urgent ? roundMoney(event.urgentFee) : 0
    if (!Number.isFinite(bookingAmount) || bookingAmount <= 0) return error('请输入预约订单金额')
    if ((order.booking?.urgent || order.shipping?.urgent) && (!Number.isFinite(urgentFee) || urgentFee < 0)) {
      return error('请输入有效的加急费用')
    }
    const actualAmount = roundMoney(bookingAmount + urgentFee)
    updateData.status = 'pending_payment'
    updateData.confirmedAt = now
    updateData.confirmedBy = user._id
    updateData['pricing.originalAmount'] = actualAmount
    updateData['pricing.actualAmount'] = actualAmount
    updateData['pricing.urgentFee'] = urgentFee
    updateData['pricing.breakdown'] = {
      goodsAmount: bookingAmount,
      couponDiscount: 0,
      pointsDeduction: 0,
      shippingFee: 0,
      urgentFee,
      actualAmount,
    }
    updateData['pricing.priceLog'] = db.command.push({
      originalPrice: order.pricing?.actualAmount || 0,
      modifiedPrice: actualAmount,
      operatorId: user._id,
      operatorName: String(event.operatorName || '').trim() || user.realName || user.nickname || user.name || user.username || '后台管理员',
      operatedAt: now,
      reason: '确认预约录入金额',
      bookingAmount,
      urgentFee,
    })
    updateData['payment.status'] = 'unpaid'
    updateData['payment.method'] = ''
    updateData['payment.amount'] = actualAmount
    updateData['commission.amount'] = roundMoney(actualAmount * Number(config.commissionRate || 0.2))
    if (order.booking?.urgent || order.shipping?.urgent) {
      updateData['shipping.urgent'] = true
      updateData['booking.urgent'] = true
    }
    }
  }

  if (status === 'completed') updateData.completedAt = now
  if (status === 'completed' && order.commission) {
    updateData['commission.status'] = commissionLockDays > 0 ? 'locked' : 'settled'
    if (commissionLockDays > 0) updateData['commission.settlementEligibleAt'] = settlementEligibleAt
    else updateData['commission.settledAt'] = now
  }

  await db.collection('orders').doc(order._id).update({ data: updateData })

  if (order.type === 'booking' && order.status === 'pending_confirmation' && status === 'confirmed' && order.salespersonId) {
    const commissionAmount = updateData['commission.amount'] || 0
    if (commissionAmount > 0) {
      try {
        const { total } = await db.collection('commission_records').where({ orderId: order._id }).count()
        if (total === 0) {
          await db.collection('commission_records').add({
            data: {
              salespersonId: order.salespersonId,
              customerId: order.customerId,
              orderId: order._id,
              orderNo: order.orderNo,
              amount: commissionAmount,
              status: 'pending',
              sourceType: 'order',
              description: `预约订单 ${order.orderNo || order._id} 提成 ¥${commissionAmount}`,
              createdAt: now,
              updatedAt: now,
            },
          })
        } else {
          await db.collection('commission_records').where({ orderId: order._id }).update({
            data: { amount: commissionAmount, updatedAt: now },
          })
        }
      } catch (_e) { /* non-critical */ }
    }
  }

  if (status === 'cancelled') {
    try {
      await releaseOrderAssets(order, now)
    } catch (_e) { /* non-critical cleanup */ }
  }

  if (status === 'completed' && commissionLockDays > 0 && order.salespersonId) {
    try {
      await db.collection('commission_records').where({
        orderId: order._id,
        status: 'locked',
      }).update({
        data: { settlementEligibleAt, updatedAt: now },
      })
    } catch (_e) { /* non-critical */ }
  }

  // 订单完成时结算提成入账
  if (status === 'completed' && commissionLockDays <= 0 && order.salespersonId && order.commission && order.commission.amount > 0) {
    try {
      const commissionAmount = order.commission.amount
      // 更新提成记录状态为 settled
      const { data: lockedRecords } = await db.collection('commission_records').where({
        orderId: order._id,
        status: 'locked',
      }).get()
      for (const rec of (lockedRecords || [])) {
        await db.collection('commission_records').doc(rec._id).update({
          data: { status: 'settled', settledAt: now, updatedAt: now },
        })
      }
      // 入账代理商余额
      await db.collection('users').doc(order.salespersonId).update({
        data: {
          'commission.total': db.command.inc(commissionAmount),
          'commission.available': db.command.inc(commissionAmount),
          updatedAt: now,
        },
      })
    } catch (_e) { /* non-critical */ }
  }

  // 卡券兑换订单完成 → 标记卡券已核销
  if (status === 'completed' && order.type === 'card_redemption' && order.cardVoucherId) {
    try {
      await db.collection('card_vouchers').doc(order.cardVoucherId).update({
        data: { status: 'verified', verifiedAt: now, updatedAt: now },
      })
    } catch (_e) { /* non-critical */ }
  }

  // 订单完成 → 积分赚取
  if (status === 'completed' && order.pricing?.actualAmount > 0 && order.type !== 'recharge') {
    try {
      const { data: cfg } = await db.collection('config').doc('system').get()
      const rate = cfg?.pointsRate || 1
      const earned = Math.floor(order.pricing.actualAmount * rate)
      if (earned > 0) {
        const entry = { id: `pts_${Date.now()}`, change: earned, reason: `订单完成奖励`, createdAt: now }
        await db.collection('users').doc(order.customerId).update({
          data: {
            'points.balance': db.command.inc(earned),
            'points.history': db.command.push(entry),
            updatedAt: now,
          }
        })
      }
    } catch (_e) { /* non-critical */ }
  }

  // 订单完成 → 推荐奖励（被推荐用户的首单）
  if (status === 'completed' && order.type !== 'recharge') {
    try {
      const { data: customerDoc } = await db.collection('users').doc(order.customerId).get()
      if (customerDoc?.referredBy) {
        // 检查是否首单
        const { total } = await db.collection('orders').where({
          customerId: order.customerId,
          status: 'completed',
        }).count()
        if (total <= 1) {
          const { data: cfg } = await db.collection('config').doc('system').get()
          const reward = cfg?.referralRewardPoints || 500
          const refEntry = { id: `pts_${Date.now()}`, change: reward, reason: `推荐新用户奖励`, createdAt: now }
          await db.collection('users').doc(customerDoc.referredBy).update({
            data: {
              'points.balance': db.command.inc(reward),
              'points.history': db.command.push(refEntry),
              updatedAt: now,
            }
          })
        }
      }
    } catch (_e) { /* non-critical */ }
  }

  const operatorName = String(event.operatorName || '').trim() || user.realName || user.nickname || user.name || user.username || '用户'
  await db.collection('logs').add({
    data: {
      operatorId: user._id,
      operatorName,
      operatorRole: user.role,
      action: getStatusText(status),
      target: order._id,
      detail: `订单状态从「${getStatusText(order.status)}」变更为「${getStatusText(status)}」`,
      result: 'success',
      createdAt: formatBeijingLogTime(),
    },
  })

  const updated = await getOrder(order._id)
  return { success: true, order: { ...updated, id: updated._id } }
}
