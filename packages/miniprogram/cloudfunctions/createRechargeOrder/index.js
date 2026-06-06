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
  if (openid) {
    const { data: users } = await db.collection('users').where({ _openid: openid }).limit(1).get()
    customer = users && users[0]
    if (!customer) {
      const { data: boundUsers } = await db.collection('users').where({ boundOpenid: openid }).limit(1).get()
      customer = boundUsers && boundUsers[0]
    }
  }
  if (!customer && operatorId) {
    try {
      const { data } = await db.collection('users').doc(operatorId).get()
      customer = data
    } catch (_e) {}
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

  const tierIndex = parseInt(event.tierIndex, 10)
  if (Number.isNaN(tierIndex) || tierIndex < 0) return error('请选择充值档位')

  const customer = await getCustomer(openid, operatorId)
  if (!customer) return error('用户不存在', 'FORBIDDEN')
  if (customer.role !== 'customer') return error('仅客户账号可充值钱包', 'FORBIDDEN')

  const tier = await getRechargeTier(tierIndex)
  if (!tier) return error('充值档位不存在')

  const now = formatDateTime(new Date())
  const credit = tier.amount + tier.bonus
  const rechargeId = `rch_${Date.now()}`

  await db.collection('users').doc(customer._id).update({
    data: {
      'wallet.balance': _.inc(credit),
      'wallet.rechargeHistory': _.push({
        id: rechargeId,
        amount: tier.amount,
        bonus: tier.bonus,
        label: tier.label,
        method: 'wechat',
        status: 'paid',
        createdAt: now,
      }),
      updatedAt: now,
    },
  })

  const { data: updatedUser } = await db.collection('users').doc(customer._id).get()
  return {
    success: true,
    recharge: {
      id: rechargeId,
      amount: tier.amount,
      bonus: tier.bonus,
      credit,
      paidAt: now,
    },
    user: normalizeUser(updatedUser),
  }
}
