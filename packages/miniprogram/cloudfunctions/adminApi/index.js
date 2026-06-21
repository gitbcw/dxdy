const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const ALLOWED_FUNCTIONS = new Set([
  'adminLogin',
  'adminDashboard',
  'adminData',
  'adminUpload',
  'adjustOrderPrice',
  'assignOrderToClerk',
  'clerkShipOrder',
  'updateOrderStatus',
  'queryOrders',
  'queryLogistics',
  'reviewReturn',
  'reviewWithdrawal',
  'processInvoice',
  'reviewVerification',
  'reviewAgentApplication',
  'manageCoupon',
  'manageProduct',
  'manageReview',
  'manageTestReport',
])

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}

function isHttpEvent(event) {
  return !!(event && (event.httpMethod || event.headers || event.body !== undefined))
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  }
}

function parseBody(event) {
  if (!event) return {}
  if (event.name || event.functionName) return event
  if (!event.body) return {}
  if (typeof event.body === 'object') return event.body
  try {
    return JSON.parse(event.body)
  } catch (e) {
    return {}
  }
}

exports.main = async (event) => {
  const http = isHttpEvent(event)
  if (http && event.httpMethod === 'OPTIONS') {
    return response(204, { success: true })
  }

  try {
    const body = parseBody(event)
    const name = String(body.name || body.functionName || '')
    const data = body.data && typeof body.data === 'object' ? body.data : {}

    if (!ALLOWED_FUNCTIONS.has(name)) {
      const result = { success: false, code: 'FORBIDDEN', error: '不允许调用该后台接口' }
      return http ? response(403, result) : result
    }

    const invokeResult = await cloud.callFunction({ name, data })
    const result = invokeResult && invokeResult.result ? invokeResult.result : invokeResult
    return http ? response(200, result) : result
  } catch (e) {
    const result = { success: false, code: 'INTERNAL_ERROR', error: e.message || '后台接口调用失败' }
    return http ? response(500, result) : result
  }
}
