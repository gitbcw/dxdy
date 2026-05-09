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

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return error('登录状态无效', 'UNAUTHORIZED')

  // 获取用户
  const { data: users } = await db.collection('users').where({ _openid: openid }).limit(1).get()
  if (!users || !users.length) return error('用户不存在', 'FORBIDDEN')
  const customer = users[0]

  // 读取充值档位配置
  const tierIndex = parseInt(event.tierIndex, 10)
  if (isNaN(tierIndex) || tierIndex < 0) return error('请选择充值档位')

  let tiers = []
  try {
    const { data: cfg } = await db.collection('config').doc('system').get()
    tiers = cfg?.rechargeTiers || []
  } catch (_e) { /* use empty */ }

  if (tierIndex >= tiers.length) return error('充值档位不存在')
  const tier = tiers[tierIndex]
  const amount = Number(tier.amount) || 0
  if (amount <= 0) return error('充值金额异常')

  const now = formatDateTime(new Date())
  const orderNo = `RC${Date.now()}`

  const order = {
    orderNo,
    type: 'recharge',
    status: 'pending_payment',
    customerId: customer._id,
    customerName: customer.nickname || customer.phone || '客户',
    customerOpenid: openid,
    salespersonId: '',
    clerkId: null,
    items: [{
      productId: '',
      productName: `充值 ¥${amount}${tier.bonus > 0 ? `（赠 ¥${tier.bonus}）` : ''}`,
      productImage: '',
      spec: tier.label || `${amount}元档`,
      quantity: 1,
      unitPrice: amount,
      totalPrice: amount,
    }],
    pricing: {
      originalAmount: amount,
      actualAmount: amount,
      priceLog: [],
      shippingFee: 0,
      urgentFee: 0,
      pointsDeduction: 0,
      refundedAmount: 0,
    },
    payment: { status: 'unpaid', method: '', paidAt: '', transactionId: '' },
    shipping: { address: '虚拟充值订单', trackingNo: null, company: null, logistics: [] },
    returnRecordId: null,
    commission: { status: 'none', amount: 0, settledAt: null },
    rechargeTier: { amount, bonus: tier.bonus || 0, label: tier.label || '' },
    createdAt: now,
    updatedAt: now,
  }

  const { _id } = await db.collection('orders').add({ data: order })
  return { success: true, order: { ...order, id: _id } }
}
