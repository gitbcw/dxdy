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

function normalize(doc) {
  if (!doc) return doc
  const { _id, _openid, ...rest } = doc
  return { id: _id, ...rest }
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
    if (['admin', 'system_admin', 'service'].includes(user.role)) {
      await db.collection('users').doc(user._id).update({
        data: { boundOpenid: openid, updatedAt: formatDateTime(new Date()) },
      })
      return { ...user, boundOpenid: openid }
    }
    return user
  } catch (e) {
    return null
  }
}

function canReview(user) {
  if (!user) return false
  if (['admin', 'system_admin'].includes(user.role)) return true
  if (user.role !== 'service') return false
  return !user.permissions || user.permissions.return_review === true || user.permissions.manage_returns === true
}

function isReturnOwner(record, user, openid) {
  if (!record || !user) return false
  return record.customerId === user._id ||
    (record.customerOpenid && record.customerOpenid === openid) ||
    (record.customerOpenid && record.customerOpenid === user._openid) ||
    (record.customerOpenid && record.customerOpenid === user.boundOpenid)
}

async function getReturnRecord(id) {
  if (!id) return null
  try {
    const { data } = await db.collection('returns').doc(id).get()
    return data || null
  } catch (e) {
    return null
  }
}

function canonicalStatus(status) {
  const map = {
    pending_return_ship: 'customer_shipping',
    returned: 'received',
    verifying: 'received',
  }
  return map[status] || status
}

function getTargetStatus(event) {
  if (event.status) return canonicalStatus(String(event.status).trim())
  if (typeof event.approved === 'boolean') return event.approved ? 'approved' : 'rejected'
  return ''
}

function getAllowedStatuses(record) {
  const current = canonicalStatus(record.status)
  const base = {
    pending_review: ['approved', 'rejected'],
    approved: record.type === 'refund_only' ? ['refunding'] : ['customer_shipping', 'refunding'],
    customer_shipping: ['received'],
    received: record.type === 'exchange' ? ['exchange_shipping', 'rejected'] : ['refunding', 'rejected'],
    refunding: ['return_completed'],
    exchange_shipping: ['exchange_completed'],
  }
  return base[current] || []
}

function getStatusText(status) {
  const map = {
    pending_review: '商家审核中',
    approved: '审核通过',
    rejected: '审核驳回',
    customer_shipping: '等待客户寄回',
    received: '商品质检',
    refunding: '退款处理中',
    return_completed: '售后完成',
    exchange_shipping: '换货发货中',
    exchange_completed: '换货完成',
  }
  return map[status] || status
}

function getTimelineDesc(status) {
  const map = {
    approved: '售后申请已通过审核',
    rejected: '售后申请未通过审核',
    customer_shipping: '请客户按客服指引寄回商品',
    received: '商家已收到寄回商品，正在质检',
    refunding: '质检通过，退款处理中',
    return_completed: '本次售后已完成',
    exchange_shipping: '换货商品已进入发货流程',
    exchange_completed: '换货流程已完成',
  }
  return map[status] || '售后流程已更新'
}

function getOperatorName(user, fallback) {
  return fallback || user.realName || user.nickname || user.name || user.username || '客服'
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''

  const id = String(event.id || event.returnId || '').trim()
  const targetStatus = getTargetStatus(event)
  if (!id) return error('售后单参数缺失')
  if (!targetStatus) return error('状态参数缺失')
  if (!openid && !String(event.reviewerId || event.operatorId || '').trim()) return error('登录状态无效', 'UNAUTHORIZED')

  const user = await getCurrentUser(openid, String(event.reviewerId || event.operatorId || '').trim())

  const record = await getReturnRecord(id)
  if (!record) return error('售后记录不存在', 'NOT_FOUND')
  const isCustomerLogistics = targetStatus === 'customer_shipping' && event.sendLogistics && event.sendLogistics.trackingNo
  if (isCustomerLogistics) {
    if (!isReturnOwner(record, user, openid)) return error('只能提交自己的售后寄回物流', 'FORBIDDEN')
  } else if (!canReview(user)) {
    return error('无售后审核权限', 'FORBIDDEN')
  }

  const allowed = getAllowedStatuses(record)
  if (!allowed.includes(targetStatus)) return error('当前售后状态不可执行该操作', 'INVALID_STATUS')

  const now = formatDateTime(new Date())
  const note = String(event.note || event.reviewNote || '').trim()
  const operatorName = getOperatorName(user, String(event.operatorName || '').trim())
  const timelineEntry = {
    status: targetStatus,
    title: getStatusText(targetStatus),
    time: now,
    desc: note || getTimelineDesc(targetStatus),
  }
  const updateData = {
    status: targetStatus,
    updatedAt: now,
    timeline: db.command.push(timelineEntry),
  }

  // 客户寄回物流信息
  if (targetStatus === 'customer_shipping' && event.sendLogistics && event.sendLogistics.trackingNo) {
    updateData.sendLogistics = {
      company: String(event.sendLogistics.company || '').trim(),
      trackingNo: String(event.sendLogistics.trackingNo || '').trim(),
      sentAt: now,
    }
    timelineEntry.desc = `客户已寄回：${event.sendLogistics.company} ${event.sendLogistics.trackingNo}`
  }

  if (canonicalStatus(record.status) === 'pending_review') {
    updateData.reviewerId = user._id
    updateData.reviewNote = note
    updateData.reviewedAt = now
  }
  if (targetStatus === 'received') updateData.verificationResult = 'pending'
  if (targetStatus === 'refunding' || targetStatus === 'return_completed' || targetStatus === 'exchange_shipping') {
    updateData.verificationResult = 'qualified'
  }
  if (targetStatus === 'rejected' && canonicalStatus(record.status) === 'received') {
    updateData.verificationResult = 'unqualified'
  }

  await db.collection('returns').doc(record._id).update({ data: updateData })

  // 退款审批通过时，累计订单的已退款金额
  if (targetStatus === 'refunding' && record.orderId) {
    const refundAmount = record.refundAmount || record.amount || 0
    if (refundAmount > 0) {
      try {
        await db.collection('orders').doc(record.orderId).update({
          data: {
            'pricing.refundedAmount': db.command.inc(refundAmount),
            updatedAt: now,
          },
        })
      } catch (_e) { /* non-critical: log but don't block */ }
    }
  }

  // 退款完成时扣回提成
  if (targetStatus === 'return_completed' && record.orderId) {
    try {
      const { data: origOrder } = await db.collection('orders').doc(record.orderId).get()
      if (origOrder && origOrder.salespersonId) {
        const commissionAmount = origOrder.commission && origOrder.commission.amount || 0
        if (commissionAmount > 0) {
          const orderAmount = origOrder.pricing && typeof origOrder.pricing.actualAmount === 'number'
            ? origOrder.pricing.actualAmount
            : 0
          const refundAmount = record.refundAmount || record.amount || 0
          const deductTarget = orderAmount > 0
            ? Math.min(commissionAmount, Math.round(commissionAmount * Math.min(refundAmount, orderAmount) / orderAmount * 100) / 100)
            : commissionAmount
          // 查找该订单的提成记录
          const { data: commissionRecords } = await db.collection('commission_records').where({
            orderId: record.orderId,
            salespersonId: origOrder.salespersonId,
          }).get()
          let deductedAmount = 0
          let balanceDeductedAmount = 0
          for (const cr of (commissionRecords || [])) {
            const amountToDeduct = Math.max(0, Math.min((cr.amount || 0), Math.round((deductTarget - deductedAmount) * 100) / 100))
            if (amountToDeduct <= 0) break
            if (cr.status === 'pending' || cr.status === 'locked' || cr.status === 'settled') {
              // 未结算的直接标记扣回
              await db.collection('commission_records').doc(cr._id).update({
                data: { status: 'deducted', deductedAt: now, deductedAmount: amountToDeduct, deductReason: `售后退款扣回：${record.afterNo || record._id}` },
              })
              deductedAmount += amountToDeduct
              if (cr.status === 'settled') balanceDeductedAmount += amountToDeduct
            } else if (cr.status === 'withdrawn') {
              // 已提现的，在代理商余额中扣回（标记为待扣回）
              deductedAmount += amountToDeduct
              balanceDeductedAmount += amountToDeduct
            }
          }
          // 更新售后记录的提成调整信息
          await db.collection('returns').doc(record._id).update({
            data: {
              'commissionAdjust.amount': deductedAmount,
              'commissionAdjust.reason': deductedAmount > 0 ? `扣回提成 ¥${deductedAmount}` : '无提成需扣回',
            },
          })
          // 同步扣减代理商余额
          if (balanceDeductedAmount > 0) {
            try {
              const { data: salesperson } = await db.collection('users').doc(origOrder.salespersonId).get()
              const available = (salesperson && salesperson.commission && salesperson.commission.available) || 0
              if (available >= balanceDeductedAmount) {
                // 余额充足，直接扣减
                await db.collection('users').doc(origOrder.salespersonId).update({
                  data: {
                    'commission.available': db.command.inc(-balanceDeductedAmount),
                    'commission.total': db.command.inc(-balanceDeductedAmount),
                    updatedAt: now,
                  },
                })
              } else {
                // 余额不足，扣完 available，剩余记入 pendingDeduction
                const remaining = balanceDeductedAmount - available
                await db.collection('users').doc(origOrder.salespersonId).update({
                  data: {
                    'commission.available': 0,
                    'commission.total': db.command.inc(-balanceDeductedAmount),
                    'commission.pendingDeduction': db.command.inc(remaining),
                    updatedAt: now,
                  },
                })
              }
            } catch (_e2) { /* non-critical */ }
          }
          await db.collection('logs').add({
            data: {
              operatorId: user._id, operatorName, operatorRole: user.role,
              action: '提成扣回',
              target: record.orderId,
              detail: `售后退款完成，扣回代理商 ${origOrder.salespersonId} 提成 ¥${deductedAmount}`,
              result: 'success',
              createdAt: now,
            },
          })
        }
      }
    } catch (_e) { /* non-critical */ }
  }

  // 换货发货：验货通过后创建换货发货订单进入制单员待办
  if (targetStatus === 'exchange_shipping' && record.orderId) {
    try {
      const { data: origOrder } = await db.collection('orders').doc(record.orderId).get()
      if (origOrder) {
        const exchangeOrder = {
          orderNo: `EX${Date.now()}`,
          type: 'exchange',
          status: 'pending_shipment',
          returnId: record._id,
          originalOrderId: record.orderId,
          customerId: origOrder.customerId || '',
          customerName: origOrder.customerName || '',
          customerOpenid: origOrder.customerOpenid || '',
          salespersonId: origOrder.salespersonId || '',
          clerkId: origOrder.clerkId || null,
          items: record.items || origOrder.items || [],
          pricing: { originalAmount: 0, actualAmount: 0, shippingFee: 0, urgentFee: 0, pointsDeduction: 0, refundedAmount: 0 },
          payment: { status: 'unpaid', method: '', paidAt: '', transactionId: '' },
          shipping: {
            address: origOrder.shipping?.address || origOrder.shippingAddress || {},
            trackingNo: null,
            company: null,
            logistics: [],
          },
          commission: { status: 'none', amount: 0, settledAt: null },
          remark: `换货发货，售后单 ${record.afterNo || record._id}`,
          createdAt: now,
          updatedAt: now,
        }
        const { _id: exchangeOrderId } = await db.collection('orders').add({ data: exchangeOrder })
        // 在 returns 记录中关联换货订单
        await db.collection('returns').doc(record._id).update({
          data: { exchangeOrderId, updatedAt: now },
        })
        await db.collection('logs').add({
          data: {
            operatorId: user._id,
            operatorName,
            operatorRole: user.role,
            action: '创建换货发货订单',
            target: exchangeOrderId,
            detail: `售后单 ${record.afterNo || record._id} 验货通过，创建换货发货订单 ${exchangeOrderId}，指派制单员 ${origOrder.clerkId || '待指派'}`,
            result: 'success',
            createdAt: now,
          },
        })
      }
    } catch (_e) { /* non-critical */ }
  }

  await db.collection('logs').add({
    data: {
      operatorId: user._id,
      operatorName,
      operatorRole: user.role,
      action: getStatusText(targetStatus),
      target: record._id,
      detail: `售后单 ${record.afterNo || record._id} 从「${getStatusText(canonicalStatus(record.status))}」变更为「${getStatusText(targetStatus)}」${note ? `，备注：${note}` : ''}`,
      result: 'success',
      createdAt: now,
    },
  })

  const updated = await getReturnRecord(record._id)
  return { success: true, record: normalize(updated) }
}
