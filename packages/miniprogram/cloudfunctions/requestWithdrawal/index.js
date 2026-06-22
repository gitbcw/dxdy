const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const MIN_WECHAT_WITHDRAW_AMOUNT = 0.3
const MAX_WECHAT_WITHDRAW_AMOUNT = 200

function formatBeijingTime(date = new Date()) {
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const y = beijing.getUTCFullYear()
  const m = String(beijing.getUTCMonth() + 1).padStart(2, '0')
  const d = String(beijing.getUTCDate()).padStart(2, '0')
  const h = String(beijing.getUTCHours()).padStart(2, '0')
  const min = String(beijing.getUTCMinutes()).padStart(2, '0')
  const s = String(beijing.getUTCSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}:${s}+08:00`
}

function error(message, code = 'BAD_REQUEST') {
  return { success: false, code, error: message }
}

function normalize(doc) {
  if (!doc) return doc
  const { _id, _openid, ...rest } = doc
  return { id: _id, ...rest }
}

async function getCurrentUser(openid, userId) {
  if (userId) {
    try {
      const { data: user } = await db.collection('users').doc(userId).get()
      if (!user) return null
      if (user._openid && user._openid !== openid) return null
      if (user.boundOpenid && user.boundOpenid !== openid) return null
      if (!user._openid && !user.boundOpenid) {
        await db.collection('users').doc(user._id).update({
          data: { boundOpenid: openid, updatedAt: formatBeijingTime() },
        })
        return { ...user, boundOpenid: openid }
      }
      return user
    } catch (_e) {
      return null
    }
  }

  const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
  if (data && data.length) return data[0]
  const { data: boundUsers } = await db.collection('users').where({ boundOpenid: openid }).limit(1).get()
  return boundUsers && boundUsers.length ? boundUsers[0] : null
}

function canRequestWithdrawal(user) {
  if (!user) return false
  return user.role === 'salesperson' || user.agentStatus === 'approved'
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return error('登录状态无效', 'UNAUTHORIZED')

  const user = await getCurrentUser(openid, String(event.salespersonId || event.userId || '').trim())
  if (!user) return error('当前微信未绑定代理商账号', 'FORBIDDEN')
  if (!canRequestWithdrawal(user)) return error('仅已通过认证的代理商可申请提现', 'FORBIDDEN')

  const amount = Math.round(Number(event.amount) * 100) / 100
  const bankCardId = String(event.bankCardId || '').trim()
  if (!Number.isFinite(amount) || amount <= 0) return error('请输入有效提现金额')
  if (amount < MIN_WECHAT_WITHDRAW_AMOUNT || amount >= MAX_WECHAT_WITHDRAW_AMOUNT) {
    return error('单笔提现金额需满足：0.30 元 <= 金额 < 200 元', 'WITHDRAW_AMOUNT_LIMIT')
  }
  if (!bankCardId) return error('请选择提现银行卡')

  let minWithdrawAmount = MIN_WECHAT_WITHDRAW_AMOUNT
  try {
    const { data: configDoc } = await db.collection('config').doc('system').get()
    if (configDoc && typeof configDoc.minWithdrawAmount === 'number') {
      minWithdrawAmount = configDoc.minWithdrawAmount
    }
  } catch (_e) {
    // Use default minimum amount.
  }
  if (amount < minWithdrawAmount) return error(`提现金额需满${minWithdrawAmount}元`)

  const available = Number(user.commission?.available || 0)
  if (available < amount) return error('超过可提现金额', 'INSUFFICIENT_BALANCE')

  const bankCard = Array.isArray(user.bankCards)
    ? user.bankCards.find((item) => item.id === bankCardId)
    : null
  if (!bankCard) return error('银行卡不存在')

  const now = formatBeijingTime()
  const withdrawalRecord = {
    _openid: openid,
    salespersonId: user._id,
    salespersonOpenid: openid,
    salespersonName: user.realName || user.nickname || user.name || user.phone || '代理商',
    salespersonPhone: user.phone || '',
    amount,
    bankCardId,
    bankName: bankCard.bankName || '',
    cardNo: bankCard.cardNo || '',
    holderName: bankCard.holderName || '',
    status: 'pending_review',
    payMode: 'offline_bank_transfer',
    payModeText: '线下银行卡打款',
    appliedAt: now,
    createdAt: now,
    updatedAt: now,
  }

  const updateResult = await db.collection('users').where({
    _id: user._id,
    'commission.available': _.gte(amount),
  }).update({
    data: {
      'commission.available': _.inc(-amount),
      'commission.withdrawn': _.inc(amount),
      updatedAt: now,
    },
  })
  if (!updateResult.stats || updateResult.stats.updated < 1) {
    return error('超过可提现金额', 'INSUFFICIENT_BALANCE')
  }

  let id = ''
  try {
    const addResult = await db.collection('withdrawals').add({ data: withdrawalRecord })
    id = addResult._id
  } catch (_e) {
    await db.collection('users').doc(user._id).update({
      data: {
        'commission.available': _.inc(amount),
        'commission.withdrawn': _.inc(-amount),
        updatedAt: now,
      },
    })
    return error('提现记录创建失败，请稍后重试')
  }

  await db.collection('logs').add({
    data: {
      operatorId: user._id,
      operatorName: withdrawalRecord.salespersonName,
      operatorRole: user.role || 'salesperson',
      action: '提交提现申请',
      target: id,
      detail: `申请提现 ¥${amount} 至 ${withdrawalRecord.bankName}（${String(withdrawalRecord.cardNo).slice(-4)}），等待平台线下打款`,
      result: 'success',
      createdAt: now,
    },
  })

  return { success: true, record: normalize({ _id: id, ...withdrawalRecord }) }
}
