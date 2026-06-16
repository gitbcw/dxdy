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

function cartId(userId) {
  return `cart_${userId}`
}

async function getUserByOpenid(openid) {
  const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
  if (data && data.length) return data[0]
  const bound = await db.collection('users').where({ boundOpenid: openid }).limit(1).get()
  return bound.data && bound.data.length ? bound.data[0] : null
}

async function getProduct(productId) {
  if (!productId) return null
  try {
    const { data } = await db.collection('products').doc(productId).get()
    return data || null
  } catch (_e) {
    return null
  }
}

function getFirstSpec(product) {
  return Array.isArray(product?.specs) && product.specs[0] ? product.specs[0].value || '' : ''
}

function getFirstImage(product) {
  return Array.isArray(product?.images) && product.images[0] ? product.images[0] : product?.image || ''
}

function getCustomerCity(user) {
  const addresses = Array.isArray(user?.addresses) ? user.addresses : []
  if (!addresses.length) return ''
  const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0]
  return String(defaultAddr?.city || '').trim()
}

function normalizeCity(value) {
  return String(value || '').replace(/(省|市|特别行政区|自治区|地区|自治州|盟)$/, '').trim()
}

function isRegionVisible(product, city) {
  if (!city) return true
  const normalizedCity = normalizeCity(city)
  const match = (regions) => regions.some((region) => normalizeCity(region) === normalizedCity)
  const hidden = Array.isArray(product?.hiddenRegions) ? product.hiddenRegions : []
  if (hidden.length && match(hidden)) return false
  const visible = Array.isArray(product?.visibleRegions) ? product.visibleRegions : []
  if (visible.length && !match(visible)) return false
  return true
}

function isVisibleToCustomer(product, user) {
  const city = getCustomerCity(user)
  if (!isRegionVisible(product, city)) return false
  const visibility = product.visibility || 'all'
  const customerType = user.customerType || 'personal'
  if (visibility === 'all' || visibility === 'public') return true
  if (visibility === 'personal' || visibility === 'personal_only') return customerType === 'personal'
  if (visibility === 'institution' || visibility === 'institution_only' || visibility === 'hospital') return customerType === 'institution'
  return true
}

function getUnitPrice(product, user) {
  if (product.promotionPrice > 0 && product.promotionStart && product.promotionEnd) {
    const now = new Date()
    const start = new Date(product.promotionStart.replace(/-/g, '/'))
    const end = new Date(product.promotionEnd.replace(/-/g, '/'))
    if (now >= start && now <= end) return Number(product.promotionPrice)
  }
  if (user.customerType === 'institution' && user.verificationStatus === 'approved') {
    return Number(product.institutionPrice || product.personalPrice || 0)
  }
  return Number(product.personalPrice || product.institutionPrice || 0)
}

async function readCart(user) {
  try {
    const { data } = await db.collection('carts').doc(cartId(user._id)).get()
    return data || null
  } catch (_e) {
    return null
  }
}

async function writeCart(user, items, now) {
  const doc = {
    userId: user._id,
    openid: user._openid || user.boundOpenid || '',
    items,
    updatedAt: now,
  }
  const id = cartId(user._id)
  try {
    const current = await readCart(user)
    if (current) {
      await db.collection('carts').doc(id).update({ data: doc })
      return { id, ...current, ...doc }
    }
    await db.collection('carts').doc(id).set({ data: { ...doc, createdAt: now } })
    const saved = await readCart(user)
    if (!saved) throw new Error('购物车保存失败')
    return { id, ...saved }
  } catch (e) {
    console.error('writeCart failed', { id, userId: user._id, message: e && e.message })
    throw e
  }
}

async function hydrateItems(rawItems, user) {
  const items = []
  for (const raw of rawItems || []) {
    const productId = raw.productId || raw.id || raw._id
    const product = await getProduct(productId)
    if (!product) continue
    if (product.status !== 'on_sale') continue
    if (!isVisibleToCustomer(product, user)) continue
    const quantity = Math.max(1, Number(raw.quantity || 1))
    const spec = raw.spec || getFirstSpec(product)
    const unitPrice = getUnitPrice(product, user)
    items.push({
      productId: product._id,
      id: product._id,
      name: product.name,
      productName: product.name,
      imageUrl: getFirstImage(product),
      productImage: getFirstImage(product),
      specs: product.specs || [],
      spec,
      quantity,
      stock: product.stock,
      status: product.status,
      visibility: product.visibility || 'all',
      productType: product.productType || '',
      isBloodPack: !!product.isBloodPack,
      personalPrice: product.personalPrice,
      institutionPrice: product.institutionPrice,
      unitPrice,
      lineTotal: Math.round(unitPrice * quantity * 100) / 100,
      updatedAt: raw.updatedAt || '',
      addedAt: raw.addedAt || '',
    })
  }
  return items
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return error('登录状态无效', 'UNAUTHORIZED')

  const user = await getUserByOpenid(openid)
  if (!user) return error('用户不存在', 'UNAUTHORIZED')

  const action = String(event.action || 'getCart')
  const now = formatDateTime(new Date())
  const current = await readCart(user)
  let items = Array.isArray(current?.items) ? current.items : []

  if (action === 'getCart') {
    const hydrated = await hydrateItems(items, user)
    if (hydrated.length !== items.length) {
      const visibleItems = hydrated.map((item) => ({
        productId: item.productId,
        spec: item.spec || '',
        quantity: Math.max(1, Number(item.quantity || 1)),
        addedAt: item.addedAt || now,
        updatedAt: now,
      }))
      await writeCart(user, visibleItems, now)
    }
    return { success: true, cart: { id: cartId(user._id), userId: user._id, items: hydrated, updatedAt: current?.updatedAt || '' } }
  }

  if (action === 'clearCart') {
    const cart = await writeCart(user, [], now)
    return { success: true, cart: { ...cart, items: [] } }
  }

  if (action === 'syncCart') {
    const incoming = Array.isArray(event.items) ? event.items : []
    items = incoming.map((item) => ({
      productId: item.productId || item.id || item._id,
      spec: item.spec || '',
      quantity: Math.max(1, Number(item.quantity || 1)),
      addedAt: item.addedAt || now,
      updatedAt: now,
    })).filter((item) => item.productId)
    const cart = await writeCart(user, items, now)
    const hydrated = await hydrateItems(items, user)
    if (hydrated.length !== items.length) {
      items = hydrated.map((item) => ({
        productId: item.productId,
        spec: item.spec || '',
        quantity: Math.max(1, Number(item.quantity || 1)),
        addedAt: item.addedAt || now,
        updatedAt: now,
      }))
      await writeCart(user, items, now)
    }
    return { success: true, cart: { ...cart, items: hydrated } }
  }

  if (action === 'addItem') {
    const productId = event.productId || event.item?.productId || event.item?.id || event.item?._id
    const product = await getProduct(productId)
    if (!product) return error('商品不存在', 'NOT_FOUND')
    if (product.status !== 'on_sale') return error('商品已下架', 'OFF_SALE')
    if (!isRegionVisible(product, getCustomerCity(user))) return error('该商品在您所在区域暂不销售', 'VISIBILITY_REGION')
    if (!isVisibleToCustomer(product, user)) return error('当前客户类型不可购买该商品', 'VISIBILITY')

    const quantity = Math.max(1, Number(event.quantity || event.item?.quantity || 1))
    const spec = event.spec || event.item?.spec || getFirstSpec(product)
    const existing = items.find((item) => item.productId === product._id && (item.spec || '') === spec)
    if (existing) {
      existing.quantity = Math.max(1, Number(existing.quantity || 0)) + quantity
      existing.updatedAt = now
    } else {
      items.push({ productId: product._id, spec, quantity, addedAt: now, updatedAt: now })
    }
    const cart = await writeCart(user, items, now)
    return { success: true, cart: { ...cart, items: await hydrateItems(items, user) } }
  }

  if (action === 'updateQuantity') {
    const productId = event.productId || event.id
    const spec = event.spec || ''
    const quantity = Math.max(0, Number(event.quantity || 0))
    items = items.map((item) => {
      if (item.productId === productId && (item.spec || '') === spec) return { ...item, quantity, updatedAt: now }
      return item
    }).filter((item) => item.quantity > 0)
    const cart = await writeCart(user, items, now)
    return { success: true, cart: { ...cart, items: await hydrateItems(items, user) } }
  }

  if (action === 'removeItem') {
    const productId = event.productId || event.id
    const spec = event.spec || ''
    items = items.filter((item) => !(item.productId === productId && (item.spec || '') === spec))
    const cart = await writeCart(user, items, now)
    return { success: true, cart: { ...cart, items: await hydrateItems(items, user) } }
  }

  return error('Invalid action')
}
