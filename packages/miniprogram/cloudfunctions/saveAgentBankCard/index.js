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

function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

function normalizeCardNo(value) {
  return String(value || '').replace(/\D/g, '')
}

function isValidBankCardNo(value) {
  const cardNo = normalizeCardNo(value)
  if (!/^\d{13,19}$/.test(cardNo)) return false
  let sum = 0
  let shouldDouble = false
  for (let i = cardNo.length - 1; i >= 0; i -= 1) {
    let digit = Number(cardNo[i])
    if (shouldDouble) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    shouldDouble = !shouldDouble
  }
  return sum % 10 === 0
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

  const user = await getCurrentUser(openid, String(event.userId || '').trim())
  if (!user) return error('当前账号未绑定用户', 'FORBIDDEN')

  const now = formatDateTime(new Date())
  if (event.action === 'delete') {
    const cardId = String(event.cardId || '').trim()
    if (!cardId) return error('请选择要删除的银行卡')

    const cards = Array.isArray(user.bankCards) ? user.bankCards.slice() : []
    const target = cards.find((item) => item.id === cardId)
    if (!target) return error('银行卡不存在')

    const nextCards = cards.filter((item) => item.id !== cardId)
    await db.collection('users').doc(user._id).update({
      data: { bankCards: nextCards, updatedAt: now },
    })

    await db.collection('logs').add({
      data: {
        operatorId: user._id,
        operatorName: user.nickname || user.realName || user.phone || target.holderName,
        operatorRole: user.role || 'customer',
        action: '删除代理商银行卡',
        target: user._id,
        detail: `${target.bankName || '银行卡'}（${String(target.cardNo || '').slice(-4)}）`,
        result: 'success',
        createdAt: formatBeijingLogTime(),
      },
    })

    const { data: updated } = await db.collection('users').doc(user._id).get()
    return { success: true, user: normalize(updated), deletedCardId: cardId }
  }

  const card = event.card || {}
  const bankCard = {
    id: String(card.id || '').trim() || generateId('bank'),
    bankName: String(card.bankName || '').trim(),
    cardNo: normalizeCardNo(card.cardNo),
    holderName: String(card.holderName || '').trim(),
    updatedAt: now,
    createdAt: card.createdAt || now,
  }

  if (!bankCard.bankName || !bankCard.cardNo || !bankCard.holderName) return error('请完善银行卡信息')
  if (!isValidBankCardNo(bankCard.cardNo)) return error('银行卡号校验未通过，请核对后重新输入')

  const cards = Array.isArray(user.bankCards) ? user.bankCards.slice() : []
  const index = cards.findIndex((item) => item.id === bankCard.id)
  if (index >= 0) cards[index] = { ...cards[index], ...bankCard }
  else cards.unshift(bankCard)

  await db.collection('users').doc(user._id).update({
    data: { bankCards: cards, updatedAt: now },
  })

  await db.collection('logs').add({
    data: {
      operatorId: user._id,
      operatorName: user.nickname || user.realName || user.phone || bankCard.holderName,
      operatorRole: user.role || 'customer',
      action: '保存代理商银行卡',
      target: user._id,
      detail: `${bankCard.bankName}（${bankCard.cardNo.slice(-4)}）`,
      result: 'success',
      createdAt: formatBeijingLogTime(),
    },
  })

  const { data: updated } = await db.collection('users').doc(user._id).get()
  return { success: true, user: normalize(updated), bankCard }
}
