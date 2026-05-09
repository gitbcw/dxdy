const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

function formatDateTime(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function error(message, code = 'BAD_REQUEST') {
  return { success: false, code, error: message }
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

function canManage(user) {
  if (!user) return false
  return ['admin', 'system_admin'].includes(user.role) ||
    (user.role === 'service' && (!user.permissions || user.permissions.test_report_manage === true || user.permissions.manage_products === true))
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''

  const action = String(event.action || '').trim()
  if (!['createReport', 'updateReport', 'deleteReport'].includes(action)) {
    return error('无效操作')
  }
  if (!openid && !String(event.operatorId || '').trim()) return error('登录状态无效', 'UNAUTHORIZED')

  const user = await getCurrentUser(openid, String(event.operatorId || '').trim())
  if (!canManage(user)) return error('无检测报告管理权限', 'FORBIDDEN')

  const now = formatDateTime(new Date())
  const operatorName = user.realName || user.nickname || user.name || user.username || '管理员'

  if (action === 'createReport') {
    const code = String(event.code || '').trim()
    if (!code) return error('血包编号必填')
    // 检查编号唯一性
    const { data: existing } = await db.collection('test_reports').where({ code }).limit(1).get()
    if (existing && existing.length > 0) return error('该血包编号已存在')

    const report = {
      code,
      reportNo: String(event.reportNo || `RPT${Date.now()}`).trim(),
      productName: String(event.productName || '').trim(),
      batchNo: String(event.batchNo || '').trim(),
      bloodType: String(event.bloodType || '').trim(),
      collectedAt: String(event.collectedAt || '').trim(),
      testedAt: String(event.testedAt || '').trim(),
      validUntil: String(event.validUntil || '').trim(),
      items: Array.isArray(event.items) ? event.items : [],
      storage: String(event.storage || '').trim(),
      transport: String(event.transport || '').trim(),
      conclusion: String(event.conclusion || '').trim(),
      reportFileID: String(event.reportFileID || '').trim(),
      orderId: String(event.orderId || '').trim(),
      returnId: String(event.returnId || '').trim(),
      internalNote: String(event.internalNote || '').trim(),
      status: event.status === 'published' ? 'published' : 'draft',
      publishedAt: event.status === 'published' ? now : '',
      createdBy: user._id,
      createdByName: operatorName,
      createdAt: now,
      updatedAt: now,
    }

    const { _id } = await db.collection('test_reports').add({ data: report })
    await db.collection('logs').add({
      data: {
        operatorId: user._id, operatorName, operatorRole: user.role,
        action: '创建检测报告', target: _id,
        detail: `创建血包编号 ${code} 的检测报告`,
        result: 'success', createdAt: now,
      },
    })
    return { success: true, report: { ...report, id: _id } }
  }

  if (action === 'updateReport') {
    const reportId = String(event.reportId || '').trim()
    if (!reportId) return error('报告 ID 必填')

    const { data: existing } = await db.collection('test_reports').doc(reportId).get()
    if (!existing) return error('报告不存在', 'NOT_FOUND')

    const updateFields = {}
    const allowedFields = ['reportNo', 'productName', 'batchNo', 'bloodType', 'collectedAt', 'testedAt',
      'validUntil', 'items', 'storage', 'transport', 'conclusion', 'reportFileID', 'orderId', 'returnId', 'internalNote']
    for (const field of allowedFields) {
      if (event[field] !== undefined) {
        updateFields[field] = event[field]
      }
    }

    // 状态变更
    if (event.status === 'published' && existing.status !== 'published') {
      updateFields.status = 'published'
      updateFields.publishedAt = now
    } else if (event.status === 'draft' && existing.status === 'published') {
      updateFields.status = 'draft'
      updateFields.publishedAt = ''
    }

    updateFields.updatedAt = now

    await db.collection('test_reports').doc(reportId).update({ data: updateFields })
    await db.collection('logs').add({
      data: {
        operatorId: user._id, operatorName, operatorRole: user.role,
        action: '更新检测报告', target: reportId,
        detail: `更新血包编号 ${existing.code} 的检测报告`,
        result: 'success', createdAt: now,
      },
    })
    return { success: true }
  }

  if (action === 'deleteReport') {
    const reportId = String(event.reportId || '').trim()
    if (!reportId) return error('报告 ID 必填')

    const { data: existing } = await db.collection('test_reports').doc(reportId).get()
    if (!existing) return error('报告不存在', 'NOT_FOUND')
    if (existing.status === 'published') return error('已发布的报告不可删除，请先改为草稿')

    await db.collection('test_reports').doc(reportId).remove()
    await db.collection('logs').add({
      data: {
        operatorId: user._id, operatorName, operatorRole: user.role,
        action: '删除检测报告', target: reportId,
        detail: `删除血包编号 ${existing.code} 的检测报告`,
        result: 'success', createdAt: now,
      },
    })
    return { success: true }
  }
}
