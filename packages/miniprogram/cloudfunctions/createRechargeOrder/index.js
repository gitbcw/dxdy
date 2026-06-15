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

function normalizeUser(user) {
  if (!user) return null
  const { _id, ...rest } = user
  return { id: _id, ...rest }
}

async function getCustomer(openid, operatorId) {
  let customer = null
  if (operatorId) {
    try {
      const { data } = await db.collection('users').doc(operatorId).get()
      if (data) return data
    } catch (_e) {}
  }
  if (openid) {
    const { data: users } = await db.collection('users').where({ _openid: openid }).limit(1).get()
    customer = users && users[0]
    if (!customer) {
      const { data: boundUsers } = await db.collection('users').where({ boundOpenid: openid }).limit(1).get()
      customer = boundUsers && boundUsers[0]
    }
  }
  return customer
}

async function getRechargeTier(tierIndex) {
  let tiers = []
  try {
    const { data: cfg } = await db.collection('config').doc('system').get()
    tiers = Array.isArray(cfg && cfg.rechargeTiers) ? cfg.rechargeTiers : []
  } catch (_e) {}

  if (tierIndex < 0 || tierIndex >= tiers.length) return null
  const tier = tiers[tierIndex]
  const amount = Number(tier.amount) || 0
  if (amount <= 0) return null
  return {
    amount,
    bonus: Number(tier.bonus || 0),
    label: tier.label || `充值 ¥${amount}`,
  }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''
  const operatorId = String(event.operatorId || '').trim()
  if (!openid && !operatorId) return error('登录状态无效', 'UNAUTHORIZED')

  if (event.action === 'getCurrentUser') {
    const customer = await getCustomer(openid, operatorId)
    if (!customer) return error('用户不存在', 'FORBIDDEN')
    return { success: true, user: normalizeUser(customer) }
  }

  const tierIndex = parseInt(event.tierIndex, 10)
  if (Number.isNaN(tierIndex) || tierIndex < 0) return error('请选择充值档位')

  const customer = await getCustomer(openid, operatorId)
  if (!customer) return error('用户不存在', 'FORBIDDEN')
  if (customer.role !== 'customer') return error('仅客户账号可充值钱包', 'FORBIDDEN')

  const tier = await getRechargeTier(tierIndex)
  if (!tier) return error('充值档位不存在')

  const now = formatDateTime(new Date())
  const orderNo = `RC${Date.now()}`
  const order = {
    orderNo,
    type: 'recharge',
    status: 'pending_payment',
    customerId: customer._id,
    customerName: customer.nickname || customer.name || customer.phone || '客户',
    customerOpenid: openid || customer._openid || customer.boundOpenid || '',
    salespersonId: '',
    clerkId: null,
    items: [{
      productId: 'wallet_recharge',
      productName: tier.label || `钱包充值 ¥${tier.amount}`,
      productImage: '',
      spec: '钱包充值',
      quantity: 1,
      unitPrice: tier.amount,
      totalPrice: tier.amount,
    }],
    pricing: {
      originalAmount: tier.amount,
      actualAmount: tier.amount,
      priceLog: [],
      shippingFee: 0,
      urgentFee: 0,
      pointsDeduction: 0,
      pointsConsumed: 0,
      pointsDeductedAt: '',
      refundedAmount: 0,
    },
    rechargeTier: {
      amount: tier.amount,
      bonus: tier.bonus,
      label: tier.label,
    },
    payment: { status: 'unpaid', method: '', paidAt: '', transactionId: '' },
    shipping: { address: null, trackingNo: null, company: null, logistics: [] },
    returnRecordId: null,
    commission: { status: 'none', amount: 0, settledAt: null },
    remark: `钱包充值 ¥${tier.amount}`,
    createdAt: now,
    updatedAt: now,
  }

  const addResult = await db.collection('orders').add({ data: order })

  return {
    success: true,
    order: {
      ...order,
      id: addResult._id,
    },
    recharge: {
      orderId: addResult._id,
      orderNo,
      amount: tier.amount,
      bonus: tier.bonus,
      credit: tier.amount + tier.bonus,
    },
    user: normalizeUser(customer),
  }
}
