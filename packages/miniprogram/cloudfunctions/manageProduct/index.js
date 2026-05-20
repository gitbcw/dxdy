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
  if (openid) {
    const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
    if (data && data.length) return data[0]

    const { data: boundUsers } = await db.collection('users').where({ boundOpenid: openid }).limit(1).get()
    if (boundUsers && boundUsers.length) return boundUsers[0]
  }

  if (!operatorId) return null
  try {
    const { data: user } = await db.collection('users').doc(operatorId).get()
    return user || null
  } catch (e) {
    return null
  }
}

function canManageProducts(user) {
  if (!user || user.status === 'disabled') return false
  return ['admin', 'system_admin', 'product_manager'].includes(user.role) ||
    (user.role === 'service' && (!user.permissions || user.permissions.manage_products === true))
}

exports.main = async (event) => {
  const action = String(event.action || '').trim()
  if (!['deleteProduct', 'updateProductStatus'].includes(action)) return error('Invalid action')

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''
  const operatorId = String(event.operatorId || '').trim()
  const user = await getCurrentUser(openid, operatorId)
  if (!canManageProducts(user)) return error('No product management permission', 'FORBIDDEN')

  const productId = String(event.productId || '').trim()
  if (!productId) return error('Missing product ID')

  let product
  try {
    const res = await db.collection('products').doc(productId).get()
    product = res.data
  } catch (e) {
    return error('Product not found', 'NOT_FOUND')
  }
  if (!product) return error('Product not found', 'NOT_FOUND')

  if (action === 'updateProductStatus') {
    if (product.isDeleted || product.deletedAt) return error('Deleted products cannot be updated', 'DELETED')
    const status = String(event.status || '').trim()
    if (!['on_sale', 'off_sale'].includes(status)) return error('Invalid product status')

    const now = formatDateTime(new Date())
    const operatorName = String(event.operatorName || user.realName || user.nickname || user.username || user._id || '')
    const updateResult = await db.collection('products').doc(productId).update({
      data: { status, updatedAt: now },
    })

    const updated = updateResult && updateResult.stats ? Number(updateResult.stats.updated || 0) : 0
    if (updated < 1) return error('Status write did not update the product', 'UPDATE_FAILED')

    await db.collection('logs').add({
      data: {
        operatorId: user._id || operatorId,
        operatorName,
        operatorRole: user.role,
        action: 'update_product_status',
        target: productId,
        detail: `Update product ${product.name || productId} status to ${status}`,
        result: 'success',
        createdAt: now,
      },
    }).catch(() => {})

    return { success: true, productId, status, updatedAt: now }
  }

  if (product.status !== 'off_sale') return error('Only off-sale products can be deleted')

  const now = formatDateTime(new Date())
  const operatorName = String(event.operatorName || user.realName || user.nickname || user.username || user._id || '')
  const updateResult = await db.collection('products').doc(productId).update({
    data: {
      isDeleted: true,
      deletedAt: now,
      deletedBy: user._id || operatorId,
      status: 'off_sale',
      updatedAt: now,
    },
  })

  const updated = updateResult && updateResult.stats ? Number(updateResult.stats.updated || 0) : 0
  if (updated < 1) return error('Delete write did not update the product', 'UPDATE_FAILED')

  await db.collection('logs').add({
    data: {
      operatorId: user._id || operatorId,
      operatorName,
      operatorRole: user.role,
      action: 'delete_product',
      target: productId,
      detail: `Delete product ${product.name || productId}`,
      result: 'success',
      createdAt: now,
    },
  }).catch(() => {})

  return { success: true, productId, deletedAt: now }
}
