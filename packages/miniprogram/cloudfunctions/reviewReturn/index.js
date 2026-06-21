const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const PAY_HTTP_FUNCTION = process.env.WECHAT_PAY_HTTP_FUNCTION || 'daxiongdongyi-nrignywh-demo-scfweb'
const PAY_HTTP_ENDPOINT = process.env.WECHAT_PAY_HTTP_ENDPOINT || ''
const DEFAULT_ENV_ID = 'cloud1-d7g7ctn4m86bada89'

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
    if (['admin', 'system_admin', 'service', 'clerk'].includes(user.role)) {
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
  if (!['service', 'clerk'].includes(user.role)) return false
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
    approved: ['customer_shipping', 'refunding'],
    customer_shipping: ['received'],
    received: record.type === 'exchange' ? ['exchange_shipping', 'rejected'] : ['refunding', 'rejected'],
    refunding: ['return_completed'],
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

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function getFirstImage(product) {
  return Array.isArray(product?.images) && product.images[0] ? product.images[0] : product?.image || ''
}

async function getProductImage(productId) {
  if (!productId) return ''
  try {
    const { data: product } = await db.collection('products').doc(productId).get()
    return getFirstImage(product)
  } catch (_e) {
    return ''
  }
}

async function buildExchangeItems(record, origOrder) {
  const sourceItems = Array.isArray(record.items) && record.items.length ? record.items : (origOrder.items || [])
  const originalItems = Array.isArray(origOrder.items) ? origOrder.items : []
  const result = []
  for (const item of sourceItems) {
    const matched = originalItems.find((orderItem) => (
      String(orderItem.productId || '') === String(item.productId || '') ||
      String(orderItem.productName || '') === String(item.productName || '')
    )) || {}
    const quantity = Math.max(1, Number(item.quantity || matched.quantity || 1))
    const unitPrice = Number(item.unitPrice || matched.unitPrice || 0)
    const productImage = item.productImage ||
      item.imageUrl ||
      matched.productImage ||
      matched.imageUrl ||
      await getProductImage(item.productId || matched.productId)
    result.push({
      ...matched,
      ...item,
      productImage,
      quantity,
      unitPrice,
      totalPrice: Number(item.totalPrice || matched.totalPrice || roundMoney(unitPrice * quantity)),
      spec: item.spec || matched.spec || '',
    })
  }
  return result
}

function hasMissingProductImage(items) {
  return !Array.isArray(items) || items.some(item => !item?.productImage)
}

function cents(amount) {
  return Math.round(Number(amount || 0) * 100)
}

function buildOutRefundNo(record) {
  const source = String(record.afterNo || record._id || Date.now()).replace(/[^A-Za-z0-9]/g, '').slice(0, 20)
  const suffix = String(Date.now()).slice(-8)
  return `RF${source}${suffix}`.slice(0, 32)
}

function getEnvId() {
  return process.env.TCB_ENV || process.env.SCF_NAMESPACE || process.env.CLOUDBASE_ENV || DEFAULT_ENV_ID
}

function getPayHttpUrl() {
  if (PAY_HTTP_ENDPOINT) return PAY_HTTP_ENDPOINT
  const envId = getEnvId()
  return `https://${envId}.service.tcloudbase.com/wx-pay`
}

function postJson(url, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload || {})
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers,
      },
      timeout: 25000,
    }, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8')
        let data = raw
        try {
          data = raw ? JSON.parse(raw) : {}
        } catch (_e) {}
        resolve({ statusCode: res.statusCode, headers: res.headers, data, raw })
      })
    })
    req.on('timeout', () => req.destroy(new Error('HTTP refund request timeout')))
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function callPayHttpFunction(payload) {
  const response = await postJson(getPayHttpUrl(), payload, {
    'X-WX-FUNCTION-NAME': PAY_HTTP_FUNCTION,
    'X-WX-SOURCE': 'wx_server',
    'X-Authmethod': 'WX_SERVER_AUTH',
  })
  return response
}

function getPaidAmount(order) {
  const paymentAmount = Number(order?.payment?.amount || 0)
  if (paymentAmount > 0) return roundMoney(paymentAmount)
  return roundMoney(order?.pricing?.actualAmount || 0)
}

function getRefundAmount(record, order) {
  const requested = roundMoney(record?.refundAmount || record?.amount || 0)
  const paidAmount = getPaidAmount(order)
  if (requested > 0 && paidAmount > 0) return Math.min(requested, paidAmount)
  return requested > 0 ? requested : paidAmount
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

async function refundWallet(order, refundAmount, now) {
  if (order?.payment?.method !== 'wallet' || order?.payment?.walletRefundedAt) return
  if (!order.customerId || refundAmount <= 0) return
  await db.collection('users').doc(order.customerId).update({
    data: {
      'wallet.balance': _.inc(refundAmount),
      'wallet.refundHistory': _.push({
        id: `wref_${Date.now()}`,
        amount: refundAmount,
        reason: `售后退款：${order.orderNo || order._id}`,
        relatedOrderId: order._id,
        createdAt: now,
      }),
      updatedAt: now,
    },
  })
  await db.collection('orders').doc(order._id).update({
    data: { 'payment.walletRefundedAt': now, updatedAt: now },
  })
}

async function deductCommissionAfterRefund(order, record, now) {
  if (!order?._id || record?.commissionAdjust?.refundedAt) return
  const refundAmount = Number(record?.refundAmount || record?.amount || 0)
  const orderAmount = getPaidAmount(order)
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
          deductReason: `售后退款扣回：${record.afterNo || record._id}`,
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

  await db.collection('returns').doc(record._id).update({
    data: {
      'commissionAdjust.amount': deductedAmount,
      'commissionAdjust.reason': deductedAmount > 0 ? `扣回提成 ¥${deductedAmount}` : '无提成需扣回',
      'commissionAdjust.refundedAt': now,
      updatedAt: now,
    },
  })
}

async function markReturnCompleted(record, order, now, refundMeta = {}) {
  const latestRecord = await getReturnRecord(record._id)
  if (canonicalStatus(latestRecord?.status) === 'return_completed') return latestRecord

  await db.collection('returns').doc(record._id).update({
    data: {
      status: 'return_completed',
      refundStatus: 'success',
      refundCompletedAt: now,
      refund: {
        ...(latestRecord?.refund || {}),
        ...refundMeta,
        status: 'success',
        completedAt: now,
        requestError: '',
        requestFailedAt: '',
      },
      timeline: _.push({
        status: 'return_completed',
        title: getStatusText('return_completed'),
        time: now,
        desc: '退款已完成，售后单自动完成',
      }),
      updatedAt: now,
    },
  })

  if (order?._id) {
    await db.collection('orders').doc(order._id).update({
      data: {
        'payment.refundStatus': 'success',
        'payment.refundedAt': now,
        'pricing.refundedAmount': _.inc(getRefundAmount(record, order)),
        updatedAt: now,
      },
    })
  }

  return getReturnRecord(record._id)
}

async function completeNonWechatRefund(record, order, now, refundAmount) {
  await refundWallet(order, refundAmount, now)
  await restoreCoupon(order, now)
  await restorePoints(order, now)
  await restoreCardVoucher(order, now)
  await deductCommissionAfterRefund(order, record, now)
  return markReturnCompleted(record, order, now, {
    method: order?.payment?.method || 'unknown',
    amount: refundAmount,
  })
}

async function requestRefund(record, order, now, refundAmount) {
  if (record?.refund?.status === 'processing' || record?.refund?.status === 'success') return record
  if (order?.payment?.method !== 'wechat') {
    return completeNonWechatRefund(record, order, now, refundAmount)
  }

  const outTradeNo = order?.payment?.outTradeNo || ''
  const transactionId = order?.payment?.transactionId || ''
  if (!outTradeNo && !transactionId) return error('缺少微信支付交易单号，无法原路退款', 'PAYMENT_REFUND_MISSING')

  const outRefundNo = buildOutRefundNo(record)
  const total = cents(getPaidAmount(order))
  const refund = cents(refundAmount)
  if (refund <= 0 || total <= 0) return error('退款金额异常', 'REFUND_AMOUNT_INVALID')

  const payload = {
    _action: 'wxpay_refund',
    out_refund_no: outRefundNo,
    reason: `售后退款 ${record.afterNo || record._id}`.slice(0, 80),
    amount: { refund, total, currency: 'CNY' },
    ...(transactionId && transactionId !== outTradeNo ? { transaction_id: transactionId } : { out_trade_no: outTradeNo }),
  }
  let response
  try {
    response = await callPayHttpFunction(payload)
  } catch (e) {
    await db.collection('returns').doc(record._id).update({
      data: {
        'refund.requestError': e.message || String(e),
        'refund.requestFailedAt': now,
        updatedAt: now,
      },
    })
    return error(e.message || 'Wechat refund request failed', 'WECHAT_REFUND_FAILED')
  }
  const result = response?.data || {}
  const refundResponse = result?.data?.data || result?.data
  const accepted = response?.statusCode >= 200 && response?.statusCode < 300 && result?.code === 0 && (
    (result?.data?.status === 200 && refundResponse) ||
    refundResponse?.out_refund_no ||
    refundResponse?.refund_id
  )
  if (!accepted) {
    await db.collection('returns').doc(record._id).update({
      data: {
        'refund.requestError': result?.msg || refundResponse?.message || response?.raw || 'Wechat refund request failed',
        'refund.requestResult': result,
        'refund.requestFailedAt': now,
        updatedAt: now,
      },
    })
    return error(result?.msg || refundResponse?.message || 'Wechat refund request failed', 'WECHAT_REFUND_FAILED')
  }

  await db.collection('returns').doc(record._id).update({
    data: {
      status: 'refunding',
      refundStatus: 'processing',
      refund: {
        method: 'wechat',
        status: 'processing',
        amount: refundAmount,
        outRefundNo,
        outTradeNo,
        transactionId,
        requestedAt: now,
        requestResult: refundResponse,
        requestError: '',
        requestFailedAt: '',
      },
      timeline: _.push({
        status: 'refunding',
        title: getStatusText('refunding'),
        time: now,
        desc: '微信原路退款已提交，等待微信退款成功回调',
      }),
      updatedAt: now,
    },
  })
  await db.collection('orders').doc(order._id).update({
    data: {
      'payment.refundStatus': 'processing',
      'payment.outRefundNo': outRefundNo,
      updatedAt: now,
    },
  })
  return getReturnRecord(record._id)
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
    updateData.sendLogistics = _.set({
      company: String(event.sendLogistics.company || '').trim(),
      trackingNo: String(event.sendLogistics.trackingNo || '').trim(),
      sentAt: now,
    })
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

  // 确认退款需要特殊处理：微信支付只发起原路退款，等微信退款回调后再标记售后完成。
  if (targetStatus === 'return_completed' && record.orderId) {
    try {
      const { data: origOrder } = await db.collection('orders').doc(record.orderId).get()
      if (!origOrder) return error('关联订单不存在', 'ORDER_NOT_FOUND')
      const refundAmount = getRefundAmount(record, origOrder)
      const refundRecord = await requestRefund(record, origOrder, now, refundAmount)
      if (refundRecord?.success === false) return refundRecord
      await db.collection('logs').add({
        data: {
          operatorId: user._id,
          operatorName,
          operatorRole: user.role,
          action: origOrder?.payment?.method === 'wechat' ? '发起微信退款' : getStatusText(targetStatus),
          target: record._id,
          detail: origOrder?.payment?.method === 'wechat'
            ? `售后单 ${record.afterNo || record._id} 已发起微信原路退款，金额 ¥${refundAmount}`
            : `售后单 ${record.afterNo || record._id} 退款完成，金额 ¥${refundAmount}`,
          result: 'success',
          createdAt: formatBeijingLogTime(),
        },
      })
      return { success: true, record: normalize(refundRecord) }
    } catch (e) {
      return error(e.message || '退款确认失败', 'REFUND_CONFIRM_FAILED')
    }
  }

  await db.collection('returns').doc(record._id).update({ data: updateData })

  // 验货合格后先进入退款处理中，后续由管理员点击确认退款发起实际退款。
  if (targetStatus === 'refunding' && record.orderId) {
    try {
      const { data: order } = await db.collection('orders').doc(record.orderId).get()
      if (!order) return error('关联订单不存在', 'ORDER_NOT_FOUND')
      const refundAmount = getRefundAmount(record, order)
      await db.collection('returns').doc(record._id).update({
        data: {
          refundStatus: 'pending_confirm',
          refund: {
            ...(record.refund || {}),
            method: order?.payment?.method || 'unknown',
            status: 'pending_confirm',
            amount: refundAmount,
            requestedAt: now,
          },
          updatedAt: now,
        },
      })
      await db.collection('orders').doc(order._id).update({
        data: {
          'payment.refundStatus': 'pending_confirm',
          updatedAt: now,
        },
      })
    } catch (e) {
      return error(e.message || '退款处理失败', 'REFUND_REQUEST_FAILED')
    }
  }

  // Exchange shipment only creates or reuses a zero-amount shipment order.
  if (targetStatus === 'exchange_shipping' && record.orderId) {
    try {
      const { data: origOrder } = await db.collection('orders').doc(record.orderId).get()
      if (origOrder) {
        const exchangeItems = await buildExchangeItems(record, origOrder)
        let exchangeOrderId = record.exchangeOrderId || ''
        let existingExchangeOrder = null
        if (!exchangeOrderId) {
          const { data: existingOrders } = await db.collection('orders').where({
            type: 'exchange',
            returnId: record._id,
          }).limit(1).get()
          existingExchangeOrder = existingOrders?.[0] || null
          exchangeOrderId = existingExchangeOrder?._id || ''
        } else {
          try {
            const { data: existingOrder } = await db.collection('orders').doc(exchangeOrderId).get()
            existingExchangeOrder = existingOrder || null
          } catch (_e) {
            existingExchangeOrder = null
          }
        }

        if (!exchangeOrderId) {
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
            clerkId: null,
            items: exchangeItems,
            pricing: { originalAmount: 0, actualAmount: 0, shippingFee: 0, urgentFee: 0, pointsDeduction: 0, refundedAmount: 0 },
            payment: { status: 'unpaid', method: '', paidAt: '', transactionId: '' },
            shipping: {
              address: origOrder.shipping?.address || origOrder.shippingAddress || {},
              trackingNo: null,
              company: null,
              logistics: [],
            },
            commission: { status: 'none', amount: 0, settledAt: null },
            remark: `Exchange shipment for return ${record.afterNo || record._id}`,
            createdAt: now,
            updatedAt: now,
          }
          const { _id } = await db.collection('orders').add({ data: exchangeOrder })
          exchangeOrderId = _id
          await db.collection('logs').add({
            data: {
              operatorId: user._id,
              operatorName,
              operatorRole: user.role,
              action: 'create_exchange_order',
              target: exchangeOrderId,
              detail: `Return ${record.afterNo || record._id} created exchange shipment order ${exchangeOrderId}; clerk ${origOrder.clerkId || 'pending'}`,
              result: 'success',
              createdAt: formatBeijingLogTime(),
            },
          })
        } else if (existingExchangeOrder && hasMissingProductImage(existingExchangeOrder.items)) {
          await db.collection('orders').doc(exchangeOrderId).update({
            data: {
              items: exchangeItems,
              updatedAt: now,
            },
          })
        }

        await db.collection('returns').doc(record._id).update({
          data: { exchangeOrderId, updatedAt: now },
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
      createdAt: formatBeijingLogTime(),
    },
  })

  const updated = await getReturnRecord(record._id)
  return { success: true, record: normalize(updated) }
}
