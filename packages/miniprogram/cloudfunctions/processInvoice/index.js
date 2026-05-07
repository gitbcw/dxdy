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
    if (['admin', 'system_admin', 'finance', 'service'].includes(user.role)) {
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

function canProcessInvoice(user) {
  if (!user) return false
  if (['admin', 'system_admin', 'finance'].includes(user.role)) return true
  if (user.role !== 'service') return false
  return user.permissions && (user.permissions.invoice_process === true || user.permissions.manage_finance === true)
}

async function getInvoice(id) {
  if (!id) return null
  try {
    const { data } = await db.collection('invoices').doc(id).get()
    return data || null
  } catch (e) {
    return null
  }
}

function getTargetStatus(event) {
  if (event.status) {
    const status = String(event.status).trim()
    if (status === 'invoiced' || status === 'approved') return 'issued'
    return status
  }
  if (event.rejected === true) return 'rejected'
  return 'issued'
}

function getStatusText(status) {
  const map = {
    pending: '待开票',
    issued: '已开票',
    rejected: '开票驳回',
  }
  return map[status] || status
}

function getOperatorName(user, fallback) {
  return fallback || user.realName || user.nickname || user.name || user.username || '财务'
}

function buildShipping(event) {
  const trackingNo = String(event.trackingNo || event.shipping?.trackingNo || '').trim()
  const company = String(event.company || event.shipping?.company || '').trim()
  if (!trackingNo && !company) return null
  return {
    trackingNo,
    company,
    shippedAt: String(event.shippedAt || '').trim(),
  }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''

  const id = String(event.id || event.invoiceId || '').trim()
  const targetStatus = getTargetStatus(event)
  if (!id) return error('发票记录参数缺失')
  if (!['issued', 'rejected'].includes(targetStatus)) return error('发票状态参数无效')
  if (!openid && !String(event.operatorId || event.reviewerId || '').trim()) return error('登录状态无效', 'UNAUTHORIZED')

  const user = await getCurrentUser(openid, String(event.operatorId || event.reviewerId || '').trim())
  if (!canProcessInvoice(user)) return error('无开票处理权限', 'FORBIDDEN')

  const invoice = await getInvoice(id)
  if (!invoice) return error('发票记录不存在', 'NOT_FOUND')
  if (invoice.status !== 'pending') return error('当前发票状态不可处理', 'INVALID_STATUS')

  const now = formatDateTime(new Date())
  const note = String(event.note || event.reviewNote || '').trim()
  const invoiceFileID = String(event.invoiceFileID || event.fileID || '').trim()
  const invoiceNo = String(event.invoiceNo || '').trim()
  const shipping = buildShipping(event)

  if (targetStatus === 'issued' && invoice.invoiceType === 'electronic' && !invoiceFileID) {
    return error('电子发票请上传发票文件')
  }
  if (targetStatus === 'rejected' && !note) return error('请填写驳回原因')

  const operatorName = getOperatorName(user, String(event.operatorName || '').trim())
  const updateData = {
    status: targetStatus,
    processorId: user._id,
    processorName: operatorName,
    processNote: note,
    processedAt: now,
    updatedAt: now,
  }

  if (targetStatus === 'issued') {
    updateData.invoiceNo = invoiceNo
    updateData.invoiceFileID = invoiceFileID
    updateData.issuedAt = now
    if (shipping) updateData.shipping = shipping
  }
  if (targetStatus === 'rejected') {
    updateData.rejectReason = note
  }

  await db.collection('invoices').doc(invoice._id).update({ data: updateData })

  await db.collection('orders').doc(invoice.orderId).update({
    data: {
      invoice: {
        invoiceId: invoice._id,
        status: targetStatus,
        title: invoice.title,
        amount: invoice.amount,
        invoiceNo,
        invoiceFileID,
        rejectedReason: targetStatus === 'rejected' ? note : '',
        updatedAt: now,
      },
      updatedAt: now,
    },
  })

  await db.collection('logs').add({
    data: {
      operatorId: user._id,
      operatorName,
      operatorRole: user.role,
      action: getStatusText(targetStatus),
      target: invoice._id,
      detail: `发票申请 ${invoice.orderNo || invoice.orderId} 变更为「${getStatusText(targetStatus)}」${note ? `，备注：${note}` : ''}`,
      result: 'success',
      createdAt: now,
    },
  })

  const updated = await getInvoice(invoice._id)
  return { success: true, invoice: normalize(updated) }
}
