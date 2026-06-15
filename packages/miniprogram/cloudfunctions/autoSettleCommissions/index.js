const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

function parseDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  const text = String(value).trim()
  if (!text) return null
  const date = new Date(text.includes('T') ? text : text.replace(' ', 'T'))
  if (!Number.isNaN(date.getTime())) return date
  const fallback = new Date(text.replace(/-/g, '/'))
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

function formatDateTime(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

async function fetchDueRecords(limit, now) {
  const { data } = await db.collection('commission_records').where({
    status: 'locked',
    settlementEligibleAt: _.lte(formatDateTime(now)),
  }).limit(limit).get()
  return data || []
}

async function settleRecord(record, nowText) {
  const amount = roundMoney(record.amount)
  if (!record.salespersonId || amount <= 0) {
    await db.collection('commission_records').doc(record._id).update({
      data: {
        status: 'skipped',
        skippedReason: !record.salespersonId ? 'missing_salesperson' : 'invalid_amount',
        updatedAt: nowText,
      },
    })
    return { success: false, skipped: true, reason: !record.salespersonId ? 'missing_salesperson' : 'invalid_amount' }
  }

  const didSettle = await db.runTransaction(async (transaction) => {
    const latest = await transaction.collection('commission_records').doc(record._id).get()
    const latestRecord = latest.data || {}
    if (latestRecord.status !== 'locked') return false

    await transaction.collection('users').doc(record.salespersonId).update({
      data: {
        'commission.total': db.command.inc(amount),
        'commission.available': db.command.inc(amount),
        updatedAt: nowText,
      },
    })

    await transaction.collection('commission_records').doc(record._id).update({
      data: {
        status: 'settled',
        settledAt: nowText,
        autoSettledAt: nowText,
        updatedAt: nowText,
      },
    })
    return true
  })

  if (!didSettle) return { success: false, skipped: true, reason: 'already_processed' }

  if (record.orderId) {
    try {
      await db.collection('orders').doc(record.orderId).update({
        data: {
          'commission.status': 'settled',
          'commission.settledAt': nowText,
          updatedAt: nowText,
        },
      })
    } catch (_e) { /* order may have been removed during test cleanup */ }
  }

  return { success: true, amount }
}

exports.main = async (event = {}) => {
  const limit = Math.min(Math.max(Number(event.limit || 100), 1), 500)
  const now = event.now ? parseDate(event.now) || new Date() : new Date()
  const nowText = formatDateTime(now)
  const records = await fetchDueRecords(limit, now)

  const results = []
  let settled = 0
  let skipped = 0
  let settledAmount = 0

  for (const record of records) {
    try {
      const result = await settleRecord(record, nowText)
      if (result.success) {
        settled += 1
        settledAmount = roundMoney(settledAmount + result.amount)
      } else {
        skipped += 1
      }
      results.push({
        recordId: record._id,
        orderId: record.orderId || '',
        orderNo: record.orderNo || '',
        salespersonId: record.salespersonId || '',
        amount: roundMoney(record.amount),
        success: !!result.success,
        skipped: !!result.skipped,
        reason: result.reason || '',
      })
    } catch (error) {
      skipped += 1
      results.push({
        recordId: record._id,
        orderId: record.orderId || '',
        orderNo: record.orderNo || '',
        salespersonId: record.salespersonId || '',
        amount: roundMoney(record.amount),
        success: false,
        error: error.message || String(error),
      })
    }
  }

  return {
    success: true,
    now: nowText,
    scanned: records.length,
    settled,
    skipped,
    settledAmount,
    results,
  }
}
