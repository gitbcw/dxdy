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

async function verifySmsCode(phone, code) {
  const { result } = await cloud.callFunction({
    name: 'sendSms',
    data: { action: 'verifyCode', phone, code },
  })
  return result
}

exports.main = async (event) => {
  const phone = String(event.phone || '').trim()
  const code = String(event.code || '').trim()
  const newPassword = String(event.newPassword || '').trim()

  if (!/^1\d{10}$/.test(phone)) return error('请输入正确手机号')
  if (!code) return error('请输入验证码')
  if (!newPassword || newPassword.length < 6) return error('新密码至少 6 位')

  const verifyResult = await verifySmsCode(phone, code)
  if (!verifyResult.success) {
    return error(verifyResult.error || '验证码校验失败', verifyResult.code || 'CODE_INVALID')
  }

  const { data } = await db.collection('users').where({ phone }).limit(1).get()
  if (!data || !data.length) return error('该手机号未注册', 'NOT_FOUND')

  const user = data[0]
  const now = formatDateTime(new Date())
  await db.collection('users').doc(user._id).update({
    data: {
      password: newPassword,
      updatedAt: now,
    },
  })

  return { success: true, message: '密码重置成功' }
}
