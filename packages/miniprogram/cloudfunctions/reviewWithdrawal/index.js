const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const PAY_HTTP_FUNCTION = process.env.WECHAT_PAY_HTTP_FUNCTION || 'daxiongdongyi-nrignywh-demo-scfweb'
const PAY_HTTP_ENDPOINT = process.env.WECHAT_PAY_HTTP_ENDPOINT || ''
const TRANSFER_NOTIFY_URL = process.env.TRANSFER_NOTIFY_URL || 'https://cloud1-d7g7ctn4m86bada89.service.tcloudbase.com/wx-pay/transferTrigger'
const TRANSFER_SCENE_ID = process.env.WECHAT_TRANSFER_SCENE_ID || '1005'
const DEFAULT_ENV_ID = 'cloud1-d7g7ctn4m86bada89'

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

function error(message, code = 'BAD_REQUEST', extra = {}) {
  return { success: false, code, error: message, ...extra }
}

function normalize(doc) {
  if (!doc) return doc
  const { _id, _openid, ...rest } = doc
  return { id: _id, ...rest }
}

async function getCurrentUser(openid, operatorId) {
  if (openid) {
    const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
    if (data && data.length) return data[0]

    const { data: boundUsers } = await db.collection('users').where({ boundOpenid: openid }).limit(1).get()
    if (boundUsers && boundUsers.length) return boundUsers[0]
  }

  if (!operatorId) return null
  try {
    const { data: user } = await db.collection('users').doc(operatorId).get()
    if (!user) return null
    if (openid && user._openid && user._openid !== openid) return null
    if (openid && user.boundOpenid && user.boundOpenid !== openid) return null
    if (openid && ['admin', 'system_admin', 'finance', 'service'].includes(user.role)) {
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

function canReviewWithdrawal(user) {
  if (!user) return false
  if (['admin', 'system_admin', 'finance'].includes(user.role)) return true
  if (user.role !== 'service') return false
  return user.permissions && (user.permissions.withdrawal_review === true || user.permissions.manage_finance === true)
}

async function getWithdrawal(id) {
  if (!id) return null
  try {
    const { data } = await db.collection('withdrawals').doc(id).get()
    return data || null
  } catch (_e) {
    return null
  }
}

function getTargetStatus(event) {
  if (event.status) {
    const status = String(event.status).trim()
    if (status === 'completed') return 'paid'
    if (status === 'pay' || status === 'auto_pay' || status === 'transfer') return 'approved'
    return status
  }
  if (typeof event.approved === 'boolean') return event.approved ? 'approved' : 'rejected'
  if (event.action === 'paid' || event.action === 'manual_paid') return 'paid'
  if (event.action === 'pay' || event.action === 'auto_pay') return 'approved'
  return ''
}

function canTransition(current, target) {
  if (current === 'pending_review') return ['approved', 'rejected', 'paid'].includes(target)
  if (current === 'approved' || current === 'transfer_failed') return ['approved', 'paid'].includes(target)
  if (current === 'transferring') return false
  return false
}

function getStatusText(status) {
  const map = {
    pending_review: '待审核',
    approved: '发起微信零钱打款',
    rejected: '提现审核驳回',
    transferring: '微信零钱打款中',
    transfer_failed: '微信零钱打款失败',
    paid: '已打款',
  }
  return map[status] || status
}

function getOperatorName(user, fallback) {
  return fallback || user.realName || user.nickname || user.name || user.username || '财务'
}

function toCents(amount) {
  return Math.round(Number(amount || 0) * 100)
}

function buildOutBillNo(record) {
  const source = String(record._id || record.id || Date.now()).replace(/[^a-zA-Z0-9]/g, '')
  return `WD${source}`.slice(0, 32)
}

function getEnvId() {
  return process.env.TCB_ENV || process.env.SCF_NAMESPACE || process.env.CLOUDBASE_ENV || DEFAULT_ENV_ID
}

function getPayHttpUrl() {
  if (PAY_HTTP_ENDPOINT) return PAY_HTTP_ENDPOINT
  return `https://${getEnvId()}.service.tcloudbase.com/wx-pay`
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
    req.on('timeout', () => req.destroy(new Error('Wechat transfer request timeout')))
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function callPayHttpFunction(payload) {
  return postJson(getPayHttpUrl(), payload, {
    'X-WX-FUNCTION-NAME': PAY_HTTP_FUNCTION,
    'X-WX-SOURCE': 'wx_server',
    'X-Authmethod': 'WX_SERVER_AUTH',
  })
}

async function rejectWithdrawal(record, user, note, now) {
  const updateResult = await db.collection('withdrawals').where({
    _id: record._id,
    status: 'pending_review',
  }).update({
    data: {
      status: 'rejected',
      reviewerId: user._id,
      reviewNote: note,
      reviewedAt: now,
      updatedAt: now,
    },
  })
  if (!updateResult.stats || updateResult.stats.updated < 1) return false

  await db.collection('users').doc(record.salespersonId).update({
    data: {
      'commission.available': _.inc(Number(record.amount || 0)),
      'commission.withdrawn': _.inc(-Number(record.amount || 0)),
      updatedAt: now,
    },
  })
  return true
}

function buildTransferPayload(record, now) {
  const openid = record.salespersonOpenid || record.openid || record._openid || ''
  const amount = toCents(record.amount)
  const outBillNo = record.transferOutBillNo || buildOutBillNo(record)
  const name = record.salespersonName || record.holderName || record.salespersonPhone || '代理商'

  return {
    _action: 'wxpay_transfer',
    appid: 'wx6f957efa365f4c03',
    out_bill_no: outBillNo,
    transfer_scene_id: TRANSFER_SCENE_ID,
    openid,
    transfer_amount: amount,
    transfer_remark: '代理商佣金提现',
    notify_url: TRANSFER_NOTIFY_URL,
    transfer_scene_report_infos: [
      { info_type: '岗位类型', info_content: '代理商' },
      { info_type: '报酬说明', info_content: '销售佣金报酬' },
      { info_type: '提现申请人', info_content: String(name).slice(0, 32) },
      { info_type: '提现申请时间', info_content: String(record.appliedAt || now).slice(0, 32) },
    ],
  }
}

function parseTransferAccepted(response) {
  const result = response?.data || {}
  const transferResponse = result?.data?.data || result?.data
  const accepted = response?.statusCode >= 200 && response?.statusCode < 300 && result?.code === 0 && (
    result?.data?.status === 200 ||
    result?.data?.status === 202 ||
    transferResponse?.out_bill_no ||
    transferResponse?.transfer_bill_no ||
    transferResponse?.state === 'ACCEPTED'
  )
  return { accepted, result, transferResponse }
}

async function startWechatTransfer(record, user, note, now, operatorName) {
  const payload = buildTransferPayload(record, now)
  if (!payload.openid) return error('提现人缺少收款 openid，无法发起微信零钱打款', 'MISSING_OPENID')
  if (!payload.transfer_amount || payload.transfer_amount < 30) return error('微信零钱打款金额不能小于 0.30 元', 'TRANSFER_AMOUNT_TOO_LOW')

  const locked = await db.collection('withdrawals').where({
    _id: record._id,
    status: _.in(['pending_review', 'approved', 'transfer_failed']),
  }).update({
    data: {
      status: 'transferring',
      reviewerId: user._id,
      reviewNote: note,
      reviewedAt: record.reviewedAt || now,
      payMode: 'wechat_transfer',
      payModeText: '微信零钱自动打款',
      transferOutBillNo: payload.out_bill_no,
      transferSceneId: payload.transfer_scene_id,
      transferAmount: payload.transfer_amount,
      transferNotifyUrl: payload.notify_url,
      transferRequestedAt: now,
      transferRequest: payload,
      payerId: user._id,
      payerName: operatorName,
      payNote: note,
      updatedAt: now,
    },
  })
  if (!locked.stats || locked.stats.updated < 1) {
    return error('提现状态已变化，请刷新后重试', 'INVALID_STATUS')
  }

  let response
  try {
    response = await callPayHttpFunction(payload)
  } catch (e) {
    await db.collection('withdrawals').doc(record._id).update({
      data: {
        status: 'transfer_failed',
        transferError: e.message || String(e),
        transferFailedAt: now,
        updatedAt: now,
      },
    })
    return error(e.message || '微信零钱打款请求失败', 'WECHAT_TRANSFER_FAILED')
  }

  const { accepted, result, transferResponse } = parseTransferAccepted(response)
  if (!accepted) {
    const reason = result?.msg || transferResponse?.message || transferResponse?.code || response?.raw || '微信零钱打款请求失败'
    await db.collection('withdrawals').doc(record._id).update({
      data: {
        status: 'transfer_failed',
        transferResult: result,
        transferError: reason,
        transferFailedAt: now,
        updatedAt: now,
      },
    })
    return error(reason, 'WECHAT_TRANSFER_FAILED', { transferResult: result })
  }

  const transferBillNo = transferResponse?.transfer_bill_no || ''
  const transferState = transferResponse?.state || 'ACCEPTED'
  await db.collection('withdrawals').doc(record._id).update({
    data: {
      status: transferState === 'SUCCESS' ? 'paid' : 'transferring',
      transferBillNo,
      transferState,
      transferResult: result,
      transferredAt: transferState === 'SUCCESS' ? now : '',
      completedAt: transferState === 'SUCCESS' ? now : '',
      paidAt: transferState === 'SUCCESS' ? now : '',
      updatedAt: now,
    },
  })

  return { success: true }
}

async function markPaid(record, user, note, now, operatorName) {
  const updateResult = await db.collection('withdrawals').where({
    _id: record._id,
    status: _.in(['pending_review', 'approved', 'transfer_failed']),
  }).update({
    data: {
      status: 'paid',
      reviewerId: user._id,
      reviewedAt: record.reviewedAt || now,
      payMode: 'manual_offline',
      payModeText: '人工线下打款',
      completedAt: now,
      paidAt: now,
      payerId: user._id,
      payerName: operatorName,
      payNote: note,
      updatedAt: now,
    },
  })
  return updateResult.stats && updateResult.stats.updated > 0
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''

  const id = String(event.id || event.withdrawalId || '').trim()
  const targetStatus = getTargetStatus(event)
  const payMode = String(event.payMode || '').trim()
  if (!id) return error('提现记录参数缺失')
  if (!targetStatus) return error('状态参数缺失')
  if (!openid && !String(event.reviewerId || event.operatorId || '').trim()) {
    return error('登录状态无效', 'UNAUTHORIZED')
  }

  const user = await getCurrentUser(openid, String(event.reviewerId || event.operatorId || '').trim())
  if (!canReviewWithdrawal(user)) return error('无提现审核权限', 'FORBIDDEN')

  const record = await getWithdrawal(id)
  if (!record) return error('提现记录不存在', 'NOT_FOUND')
  if (!canTransition(record.status, targetStatus)) {
    return error('当前提现状态不允许执行该操作', 'INVALID_STATUS')
  }

  const now = formatBeijingTime()
  const note = String(event.note || event.reviewNote || '').trim()
  const operatorName = getOperatorName(user, String(event.operatorName || '').trim())

  if (targetStatus === 'rejected') {
    const rejected = await rejectWithdrawal(record, user, note, now)
    if (!rejected) return error('提现状态已变化，请刷新后重试', 'INVALID_STATUS')
  } else if (targetStatus === 'approved') {
    const result = await startWechatTransfer(record, user, note, now, operatorName)
    if (!result.success) return result
  } else if (targetStatus === 'paid') {
    if (payMode !== 'manual_offline') return error('手动确认打款必须使用人工线下打款方式', 'INVALID_PAY_MODE')
    const paid = await markPaid(record, user, note, now, operatorName)
    if (!paid) return error('提现状态已变化，请刷新后重试', 'INVALID_STATUS')
  }

  await db.collection('logs').add({
    data: {
      operatorId: user._id,
      operatorName,
      operatorRole: user.role,
      action: getStatusText(targetStatus),
      target: record._id,
      detail: `代理商 ${record.salespersonName || record.salespersonId} 提现 ¥${record.amount} 变更为「${getStatusText(targetStatus)}」${note ? `，备注：${note}` : ''}`,
      result: 'success',
      createdAt: now,
    },
  })

  const updated = await getWithdrawal(record._id)
  return { success: true, record: normalize(updated) }
}
