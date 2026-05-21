const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

function normalize(doc) {
  if (!doc) return doc
  const { _id, ...rest } = doc
  return { id: _id, ...rest }
}

function formatDateTime(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function error(message, code = 'BAD_REQUEST') {
  return { success: false, code, error: message }
}

async function getCurrentUser(openid, userId) {
  if (openid) {
    const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
    if (data && data.length) return data[0]

    const { data: boundUsers } = await db.collection('users').where({ boundOpenid: openid }).limit(1).get()
    if (boundUsers && boundUsers.length) return boundUsers[0]
  }

  if (!userId) return null
  try {
    const { data } = await db.collection('users').doc(userId).get()
    return data || null
  } catch (e) {
    return null
  }
}

function canManageAddress(operator, customerId) {
  if (!operator || operator.status === 'disabled') return false
  if (operator._id === customerId) return true
  return ['admin', 'system_admin', 'service'].includes(operator.role)
}

async function getCustomer(customerId) {
  try {
    const { data } = await db.collection('users').doc(customerId).get()
    return data || null
  } catch (e) {
    return null
  }
}

exports.main = async (event = {}) => {
  const action = String(event.action || '').trim()
  if (!['saveAddress', 'deleteAddress'].includes(action)) return error('Invalid action')

  const customerId = String(event.customerId || '').trim()
  if (!customerId) return error('Missing customer ID')

  const wxContext = cloud.getWXContext()
  const operator = await getCurrentUser(wxContext.OPENID || '', String(event.operatorId || customerId).trim())
  if (!canManageAddress(operator, customerId)) return error('No permission to manage this address', 'FORBIDDEN')

  const customer = await getCustomer(customerId)
  if (!customer) return error('Customer not found', 'NOT_FOUND')

  const now = formatDateTime(new Date())
  let addresses = Array.isArray(customer.addresses) ? customer.addresses : []

  if (action === 'deleteAddress') {
    const addressId = String(event.addressId || '').trim()
    if (!addressId) return error('Missing address ID')
    addresses = addresses.filter((address) => address.id !== addressId)
    if (addresses.length > 0 && !addresses.some((address) => address.isDefault)) {
      addresses = addresses.map((address, index) => ({ ...address, isDefault: index === 0 }))
    }
  } else {
    const input = event.address || {}
    if (!input.name || !input.phone || !input.detail) return error('Address information is incomplete')

    const nextAddress = {
      ...input,
      id: input.id || generateId('addr'),
      isDefault: !!input.isDefault,
      updatedAt: now,
      createdAt: input.createdAt || now,
    }

    if (nextAddress.isDefault) {
      addresses = addresses.map((address) => ({ ...address, isDefault: false }))
    }
    if (addresses.length === 0) nextAddress.isDefault = true

    const index = addresses.findIndex((address) => address.id === nextAddress.id)
    if (index >= 0) {
      addresses[index] = { ...addresses[index], ...nextAddress }
    } else {
      addresses.push(nextAddress)
    }
  }

  await db.collection('users').doc(customerId).update({
    data: { addresses, updatedAt: now },
  })

  const updated = await getCustomer(customerId)
  return { success: true, user: normalize(updated) }
}
