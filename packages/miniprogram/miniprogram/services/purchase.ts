export interface PurchaseCheckProduct {
  status: string
  visibility?: string
  productType?: string
  isBloodPack?: boolean
  stock?: number
  purchaseLimit?: {
    minQuantity: number
    maxQuantityPerOrder: number
    maxQuantityPerUser: number
  }
}

export interface PurchaseCheckUser {
  customerType?: 'personal' | 'institution'
  verificationStatus?: string
  role?: string
}

export interface PurchaseCheckResult {
  allowed: boolean
  reason: string
  code?: 'not_logged_in' | 'off_sale' | 'visibility' | 'blood_pack_auth' | 'stock_insufficient' | 'purchase_limit'
}

export function canPurchase(product: PurchaseCheckProduct, user: PurchaseCheckUser | null, quantity = 1): PurchaseCheckResult {
  if (product.status !== 'on_sale') return { allowed: false, reason: '商品已下架', code: 'off_sale' }
  if (!user) return { allowed: false, reason: '请先登录', code: 'not_logged_in' }

  const customerType = user.customerType || 'personal'
  const visibility = product.visibility || 'all'
  if (visibility === 'personal_only' && customerType !== 'personal') return { allowed: false, reason: '该商品仅限普通客户', code: 'visibility' }
  if (visibility === 'institution_only' && customerType !== 'institution') return { allowed: false, reason: '该商品仅限医院客户', code: 'visibility' }

  const isBloodPack = product.productType === 'blood_pack' || product.isBloodPack
  if (isBloodPack) {
    if (customerType !== 'institution') return { allowed: false, reason: '血包商品仅限医院客户', code: 'blood_pack_auth' }
    if (user.verificationStatus !== 'approved') return { allowed: false, reason: '请先完成门店认证', code: 'blood_pack_auth' }
  }

  const isCardVoucher = product.productType === 'card_voucher'
  if (isCardVoucher && user.role !== 'salesperson') return { allowed: false, reason: '卡券仅限代理商购买', code: 'visibility' }

  if (typeof product.stock === 'number' && product.stock < quantity) return { allowed: false, reason: '库存不足', code: 'stock_insufficient' }

  const limit = product.purchaseLimit
  if (limit) {
    if (limit.minQuantity > 0 && quantity < limit.minQuantity) return { allowed: false, reason: `最少购买 ${limit.minQuantity} 件`, code: 'purchase_limit' }
    if (limit.maxQuantityPerOrder > 0 && quantity > limit.maxQuantityPerOrder) return { allowed: false, reason: `单笔最多 ${limit.maxQuantityPerOrder} 件`, code: 'purchase_limit' }
  }

  return { allowed: true, reason: '' }
}
