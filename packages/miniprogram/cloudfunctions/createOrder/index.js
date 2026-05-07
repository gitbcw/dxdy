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

function isVisibleToCustomer(product, customer) {
  const visibility = product.visibility || 'all'
  const customerType = customer.customerType || 'personal'
  if (visibility === 'all') return true
  if (visibility === 'personal' || visibility === 'personal_only') return customerType === 'personal'
  if (visibility === 'institution' || visibility === 'institution_only') return customerType === 'institution'
  return true
}

function getUnitPrice(product, customer) {
  const customerType = customer.customerType || 'personal'
  if (customerType === 'institution') {
    return Number(product.institutionPrice || product.personalPrice || 0)
  }
  return Number(product.personalPrice || product.institutionPrice || 0)
}

function getFirstSpec(product) {
  return Array.isArray(product.specs) && product.specs[0] ? product.specs[0].value || '' : ''
}

function getFirstImage(product) {
  return Array.isArray(product.images) && product.images[0] ? product.images[0] : product.image || ''
}

async function getCustomer(customerId, openid) {
  if (!customerId) return null
  try {
    const { data } = await db.collection('users').doc(customerId).get()
    if (!data || data.role !== 'customer' || data._openid !== openid) return null
    return data
  } catch (e) {
    return null
  }
}

async function getProduct(productId) {
  if (!productId) return null
  try {
    const { data } = await db.collection('products').doc(productId).get()
    return data || null
  } catch (e) {
    return null
  }
}

async function buildOrderItems(rawItems, customer) {
  const items = []

  for (const raw of rawItems) {
    const quantity = Math.max(1, Number(raw.quantity || 1))
    const product = await getProduct(raw.productId)
    if (!product) return { error: `商品不存在：${raw.productName || raw.productId || ''}` }
    if (product.status !== 'on_sale') return { error: `商品已下架：${product.name}` }
    if (!isVisibleToCustomer(product, customer)) return { error: `当前客户类型不可购买：${product.name}` }
    if (product.isBloodPack && (customer.customerType !== 'institution' || customer.verificationStatus !== 'approved')) {
      return { error: `血包商品仅限已认证医院客户购买：${product.name}` }
    }
    if (typeof product.stock === 'number' && product.stock < quantity) {
      return { error: `库存不足：${product.name}` }
    }

    const unitPrice = getUnitPrice(product, customer)
    if (!unitPrice || unitPrice <= 0) return { error: `商品价格异常：${product.name}` }

    items.push({
      productId: product._id,
      productName: product.name,
      productImage: getFirstImage(product) || raw.productImage || '',
      spec: raw.spec || getFirstSpec(product),
      quantity,
      unitPrice,
      totalPrice: Math.round(unitPrice * quantity * 100) / 100,
      testReportCode: raw.testReportCode || '',
      batchNo: raw.batchNo || product.batchNo || '',
    })
  }

  return { items }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return error('登录状态无效', 'UNAUTHORIZED')

  const customer = await getCustomer(event.customerId, openid)
  if (!customer) return error('客户不存在或无权下单', 'FORBIDDEN')

  const rawItems = Array.isArray(event.items) ? event.items : []
  if (!rawItems.length) return error('订单商品不能为空')

  const built = await buildOrderItems(rawItems, customer)
  if (built.error) return error(built.error)

  const type = event.type === 'booking' ? 'booking' : 'normal'
  if (type === 'booking' && (!event.booking || !event.booking.date || !event.booking.location)) {
    return error('请补全预约信息')
  }

  const defaultAddress = Array.isArray(customer.addresses) ? customer.addresses.find((address) => address.isDefault) : null
  const shippingAddress = event.shippingAddress || defaultAddress
  if (!shippingAddress) return error('请选择收货地址')

  const totalAmount = built.items.reduce((sum, item) => sum + item.totalPrice, 0)
  const actualAmount = Math.round(totalAmount * 100) / 100
  const now = formatDateTime(new Date())
  const order = {
    orderNo: `DD${Date.now()}`,
    type,
    status: 'pending_payment',
    customerId: customer._id,
    customerName: customer.nickname || customer.name || customer.phone || '客户',
    customerOpenid: openid,
    salespersonId: customer.boundSalespersonId || '',
    clerkId: null,
    items: built.items,
    pricing: { originalAmount: actualAmount, actualAmount, priceLog: [] },
    payment: { status: 'unpaid', method: '', paidAt: '', transactionId: '' },
    shipping: {
      address: shippingAddress,
      trackingNo: null,
      company: null,
      logistics: [],
    },
    ...(type === 'booking' ? { booking: event.booking } : {}),
    returnRecordId: null,
    commission: {
      status: 'pending',
      amount: Math.round(actualAmount * 0.2 * 100) / 100,
      settledAt: null,
    },
    ...(event.remark ? { remark: event.remark } : {}),
    createdAt: now,
    updatedAt: now,
  }

  const { _id } = await db.collection('orders').add({ data: order })
  return { success: true, order: { ...order, id: _id } }
}
