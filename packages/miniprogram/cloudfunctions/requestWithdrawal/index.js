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

async function getCurrentUser(openid, userId) {
  if (userId) {
    try {
      const { data: user } = await db.collection('users').doc(userId).get()
      if (!user) return null
      if (user._openid && user._openid !== openid) return null
      if (user.boundOpenid && user.boundOpenid !== openid) return null
      if (!user._openid && !user.boundOpenid) {
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

  const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
  if (data && data.length) return data[0]
  const { data: boundUsers } = await db.collection('users').where({ boundOpenid: openid }).limit(1).get()
  return boundUsers && boundUsers.length ? boundUsers[0] : null
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return error('登录状态无效', 'UNAUTHORIZED')

  const user = await getCurrentUser(openid, String(event.salespersonId || event.userId || '').trim())
  if (!user) return error('当前账号未绑定代理商用户', 'FORBIDDEN')
  if (user.role !== 'salesperson' && user.agentStatus !== 'approved') return error('仅已通过代理商可申请提现', 'FORBIDDEN')

  const amount = Math.round(Number(event.amount) * 100) / 100
  const bankCardId = String(event.bankCardId || '').trim()
  if (!Number.isFinite(amount) || amount <= 0) return error('请输入有效提现金额')
  if (amount < 100) return error('提现金额需满100元')
  if (!bankCardId) return error('请选择提现银行卡')

  const available = user.commission && typeof user.commission.available === 'number'
    ? user.commission.available
    : 0
  if (available < amount) return error('超过可提现金额', 'INSUFFICIENT_BALANCE')

  const bankCard = Array.isArray(user.bankCards)
    ? user.bankCards.find((item) => item.id === bankCardId)
    : null
  if (!bankCard) return error('银行卡不存在')

  const now = formatDateTime(new Date())
  const record = {
    salespersonId: user._id,
    amount,
    bankCardId,
    bankName: bankCard.bankName,
    cardNo: bankCard.cardNo,
    status: 'pending_review',
    appliedAt: now,
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
  if (!updateResult.stats || updateResult.stats.updated < 1) return error('超过可提现金额', 'INSUFFICIENT_BALANCE')

  const { _id } = await db.collection('withdrawals').add({ data: record })

  await db.collection('logs').add({
    data: {
      operatorId: user._id,
      operatorName: user.nickname || user.realName || user.phone || bankCard.holderName || '代理商',
      operatorRole: user.role || 'salesperson',
      action: '提交提现申请',
      target: _id,
      detail: `申请提现 ¥${amount} 至 ${bankCard.bankName}（${String(bankCard.cardNo || '').slice(-4)}）`,
      result: 'success',
      createdAt: now,
    },
  })

  return { success: true, record: { ...record, id: _id } }
}
