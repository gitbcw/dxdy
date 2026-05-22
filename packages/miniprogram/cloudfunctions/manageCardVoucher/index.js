const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateTime(date) {
  return `${formatDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function err(message) {
  return { success: false, error: message }
}

async function getCard(cardId) {
  const { data } = await db.collection('card_vouchers').doc(cardId).get()
  return data || null
}

async function getOrder(orderId) {
  if (!orderId) return null
  const { data } = await db.collection('orders').doc(orderId).get()
  return data || null
}

async function getUserByOpenid(openid) {
  const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
  return data?.[0] || null
}

async function getUserById(id) {
  const { data } = await db.collection('users').doc(id).get()
  return data || null
}

async function writeLog(action, operatorId, detail) {
  try {
    await db.collection('logs').add({
      data: {
        type: 'card_voucher',
        action,
        operatorId: operatorId || '',
        detail: detail || '',
        createdAt: formatDateTime(new Date()),
      },
    })
  } catch (_e) { /* non-critical */ }
}

// --- 代理商赠送卡券给医院客户 ---
async function giftCard(event, now) {
  const { cardId, toUserId } = event
  if (!cardId || !toUserId) return err('缺少卡券 ID 或目标用户 ID')

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const operator = await getUserByOpenid(openid)
  if (!operator) return err('用户不存在')
  if (operator.role !== 'salesperson') return err('仅代理商可赠送卡券')

  const card = await getCard(cardId)
  if (!card) return err('卡券不存在')
  if (card.status !== 'ungifted') return err('仅未赠送的卡券可赠送')
  if (card.purchaserId !== operator._id) return err('只能赠送自己购买的卡券')

  const purchaseOrder = await getOrder(card.purchaseOrderId)
  if (!purchaseOrder || purchaseOrder.payment?.status !== 'paid') return err('卡券采购订单未支付，暂不可赠送')

  const toUser = await getUserById(toUserId)
  if (!toUser) return err('目标用户不存在')
  if (toUser.customerType !== 'institution') return err('只能赠送给机构客户')

  // 验证在代理商客户列表中
  const salespersonCustomers = operator.customers || []
  if (!salespersonCustomers.includes(toUserId)) {
    // 也检查 boundSalespersonId
    if (toUser.boundSalespersonId !== operator._id) {
      return err('只能赠送给自己的客户')
    }
  }

  const giftEntry = {
    fromUserId: operator._id,
    fromUserName: operator.nickname || operator.phone || '',
    toUserId: toUser._id,
    toUserName: toUser.nickname || toUser.phone || '',
    action: 'gift',
    at: now,
  }

  await db.collection('card_vouchers').doc(cardId).update({
    data: {
      status: 'gifted',
      currentHolderId: toUser._id,
      currentHolderName: toUser.nickname || toUser.phone || '',
      giftHistory: _.push(giftEntry),
      updatedAt: now,
    },
  })

  await writeLog('gift_card', operator._id, `卡券 ${card.cardNo} 赠送给 ${toUser.nickname || toUser.phone}`)
  return { success: true }
}

// --- 医院客户认领卡券 ---
async function claimCard(event, now) {
  const { cardId } = event
  if (!cardId) return err('缺少卡券 ID')

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const user = await getUserByOpenid(openid)
  if (!user) return err('用户不存在')

  const card = await getCard(cardId)
  if (!card) return err('卡券不存在')
  if (card.status !== 'gifted') return err('该卡券当前不可认领')
  if (card.currentHolderId !== user._id) return err('只有持有人可认领')

  await db.collection('card_vouchers').doc(cardId).update({
    data: {
      status: 'claimed',
      updatedAt: now,
    },
  })

  await writeLog('claim_card', user._id, `认领卡券 ${card.cardNo}`)
  return { success: true }
}

// --- 医院客户转赠卡券 ---
async function regiftCard(event, now) {
  const { cardId, toUserId } = event
  if (!cardId || !toUserId) return err('缺少卡券 ID 或目标用户 ID')

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const user = await getUserByOpenid(openid)
  if (!user) return err('用户不存在')

  const card = await getCard(cardId)
  if (!card) return err('卡券不存在')
  if (!['claimed', 'gifted'].includes(card.status)) return err('该卡券当前不可转赠')
  if (card.currentHolderId !== user._id) return err('只有持有人可转赠')

  const toUser = await getUserById(toUserId)
  if (!toUser) return err('目标用户不存在')
  if (toUser._id === user._id) return err('不能转赠给自己')
  // 不限认证，只要是机构客户即可
  if (toUser.customerType !== 'institution') return err('只能转赠给机构客户')

  const giftEntry = {
    fromUserId: user._id,
    fromUserName: user.nickname || user.phone || '',
    toUserId: toUser._id,
    toUserName: toUser.nickname || toUser.phone || '',
    action: 'regift',
    at: now,
  }

  await db.collection('card_vouchers').doc(cardId).update({
    data: {
      status: 'gifted',
      currentHolderId: toUser._id,
      currentHolderName: toUser.nickname || toUser.phone || '',
      giftHistory: _.push(giftEntry),
      updatedAt: now,
    },
  })

  await writeLog('regift_card', user._id, `卡券 ${card.cardNo} 转赠给 ${toUser.nickname || toUser.phone}`)
  return { success: true }
}

// --- 认证医院兑换卡券 ---
async function redeemCard(event, now) {
  const { cardId, redeemProductId, shippingAddress } = event
  if (!cardId || !redeemProductId) return err('缺少卡券 ID 或兑换商品 ID')

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const user = await getUserByOpenid(openid)
  if (!user) return err('用户不存在')

  // 必须是认证机构
  if (user.customerType !== 'institution') return err('仅机构客户可兑换')
  if (user.verificationStatus !== 'approved') return err('请先完成医院认证')

  const card = await getCard(cardId)
  if (!card) return err('卡券不存在')
  if (card.status !== 'claimed') return err('该卡券当前不可兑换')
  if (card.currentHolderId !== user._id) return err('只有持有人可兑换')

  // 检查有效期
  if (card.expiresAt && card.expiresAt < now) {
    // 标记过期
    await db.collection('card_vouchers').doc(cardId).update({
      data: { status: 'expired', updatedAt: now },
    })
    return err('卡券已过期')
  }

  // 检查兑换商品
  const { data: product } = await db.collection('products').doc(redeemProductId).get()
  if (!product) return err('兑换商品不存在')
  if (product.productType !== 'blood_pack' && !product.isBloodPack) return err('只能兑换血包商品')
  if (product.status !== 'on_sale') return err('该商品已下架')
  if (product.stock < 1) return err('商品库存不足')

  // 检查商品分类匹配
  if (card.redeemableCategory && product.category !== card.redeemableCategory) {
    return err('该商品不在卡券可兑换范围内')
  }

  // 创建兑换订单
  const orderNo = `CV${Date.now()}`
  const order = {
    orderNo,
    type: 'card_redemption',
    status: 'pending_shipment',
    customerId: user._id,
    customerName: user.nickname || user.phone || '',
    customerOpenid: openid,
    salespersonId: card.purchaserId || '',
    clerkId: null,
    items: [{
      productId: product._id,
      productName: product.name,
      productImage: product.images?.[0] || '',
      spec: product.specs?.[0]?.value || '标准规格',
      quantity: 1,
      unitPrice: product.institutionPrice || product.personalPrice || 0,
      totalPrice: product.institutionPrice || product.personalPrice || 0,
    }],
    pricing: {
      originalAmount: product.institutionPrice || product.personalPrice || 0,
      actualAmount: 0,
      priceLog: `卡券兑换 ${card.cardNo}`,
      shippingFee: 0,
      urgentFee: 0,
      pointsDeduction: 0,
      refundedAmount: 0,
    },
    payment: {
      status: 'paid',
      method: 'card_voucher',
      paidAt: now,
      transactionId: card.cardNo,
    },
    shipping: shippingAddress ? {
      address: shippingAddress.address || '',
      name: shippingAddress.name || '',
      phone: shippingAddress.phone || '',
      trackingNo: '',
      company: '',
    } : { address: '', name: '', phone: '', trackingNo: '', company: '' },
    commission: { status: 'none', amount: 0, settledAt: null },
    cardVoucherId: card._id,
    returnRecordId: null,
    remark: `卡券 ${card.cardNo} 兑换`,
    createdAt: now,
    updatedAt: now,
  }

  const { _id: orderId } = await db.collection('orders').add({ data: order })

  // 扣减库存
  await db.collection('products').doc(redeemProductId).update({
    data: { stock: _.inc(-1) },
  })

  // 更新卡券
  await db.collection('card_vouchers').doc(cardId).update({
    data: {
      status: 'redeemed',
      redeemedOrderId: orderId,
      redeemedProductId: product._id,
      redeemedProductName: product.name,
      redeemedAt: now,
      updatedAt: now,
    },
  })

  await writeLog('redeem_card', user._id, `卡券 ${card.cardNo} 兑换商品 ${product.name}，订单 ${orderNo}`)
  return { success: true, orderId, orderNo }
}

// --- 作废卡券 ---
async function voidCard(event, now) {
  const { cardId, voidReason } = event
  if (!cardId) return err('缺少卡券 ID')

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const operator = await getUserByOpenid(openid)
  if (!operator) return err('用户不存在')

  const card = await getCard(cardId)
  if (!card) return err('卡券不存在')

  if (!['ungifted', 'gifted', 'claimed'].includes(card.status)) {
    return err('已兑换或已核销的卡券不可作废')
  }

  // 权限：管理员或购买者
  const isAdmin = ['admin', 'system_admin', 'service'].includes(operator.role)
  const isPurchaser = card.purchaserId === operator._id
  if (!isAdmin && !isPurchaser) return err('无权作废此卡券')

  await db.collection('card_vouchers').doc(cardId).update({
    data: {
      status: 'voided',
      voidedAt: now,
      voidedBy: operator._id,
      voidReason: voidReason || '',
      updatedAt: now,
    },
  })

  await writeLog('void_card', operator._id, `作废卡券 ${card.cardNo}，原因：${voidReason || '无'}`)
  return { success: true }
}

// --- 路由 ---
exports.main = async (event) => {
  const now = formatDateTime(new Date())

  switch (event.action) {
    case 'gift':    return giftCard(event, now)
    case 'claim':   return claimCard(event, now)
    case 'regift':  return regiftCard(event, now)
    case 'redeem':  return redeemCard(event, now)
    case 'void':    return voidCard(event, now)
    default:        return err(`未知操作: ${event.action}`)
  }
}
