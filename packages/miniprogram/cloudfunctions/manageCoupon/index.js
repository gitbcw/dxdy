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

// --- 创建优惠券模板 ---
async function createTemplate(event, now) {
  const { name, description, type, value, minAmount, scope, scopeIds,
    distributeMethod, totalQuota, perUserLimit, validDaysAfterClaim,
    validFrom, validTo } = event

  if (!name || !type || value === undefined) return err('缺少必填字段')
  if (!['fixed', 'discount', 'full_reduction'].includes(type)) return err('无效的优惠券类型')
  if (!['all', 'products', 'categories'].includes(scope || 'all')) return err('无效的适用范围')
  if (!['admin', 'user_claim', 'auto_new_user'].includes(distributeMethod || 'admin')) return err('无效的发放方式')

  const template = {
    name, description: description || '',
    type, value: Number(value), minAmount: Number(minAmount || 0),
    scope: scope || 'all', scopeIds: Array.isArray(scopeIds) ? scopeIds : [],
    distributeMethod: distributeMethod || 'admin',
    totalQuota: Number(totalQuota || 0), claimedCount: 0,
    perUserLimit: Number(perUserLimit || 1),
    validDaysAfterClaim: Number(validDaysAfterClaim || 0),
    validFrom: validFrom || '', validTo: validTo || '',
    status: 'active', createdAt: now, updatedAt: now,
  }

  const { _id } = await db.collection('coupon_templates').add({ data: template })
  return { success: true, template: { ...template, id: _id } }
}

// --- 更新优惠券模板 ---
async function updateTemplate(event, now) {
  const { templateId, updates } = event
  if (!templateId) return err('缺少模板 ID')

  const { data: template } = await db.collection('coupon_templates').doc(templateId).get()
  if (!template) return err('模板不存在')

  // 如果已有人领取，只允许改 name/description/status/validFrom/validTo
  const safeUpdates = { updatedAt: now }
  if (template.claimedCount > 0) {
    if (updates.name !== undefined) safeUpdates.name = updates.name
    if (updates.description !== undefined) safeUpdates.description = updates.description
    if (updates.status !== undefined) safeUpdates.status = updates.status
    if (updates.validFrom !== undefined) safeUpdates.validFrom = updates.validFrom
    if (updates.validTo !== undefined) safeUpdates.validTo = updates.validTo
  } else {
    // 无人领取时允许全部修改
    const fields = ['name', 'description', 'type', 'value', 'minAmount', 'scope', 'scopeIds',
      'distributeMethod', 'totalQuota', 'perUserLimit', 'validDaysAfterClaim', 'validFrom', 'validTo', 'status']
    for (const f of fields) {
      if (updates[f] !== undefined) safeUpdates[f] = updates[f]
    }
  }

  await db.collection('coupon_templates').doc(templateId).update({ data: safeUpdates })
  return { success: true }
}

// --- 发放优惠券给用户 ---
async function grantCoupon(event, now, adminOpenid) {
  const { templateId, userId, count, grantedBy } = event
  if (!templateId || !userId) return err('缺少模板 ID 或用户 ID')

  const { data: template } = await db.collection('coupon_templates').doc(templateId).get()
  if (!template || template.status !== 'active') return err('模板不存在或已停用')

  const num = Math.min(Number(count || 1), 10) // 单次最多发 10 张
  const results = []

  for (let i = 0; i < num; i++) {
    // 计算有效期
    let validFrom = '', validTo = ''
    if (template.validDaysAfterClaim > 0) {
      validFrom = now
      const exp = new Date()
      exp.setDate(exp.getDate() + template.validDaysAfterClaim)
      validTo = formatDateTime(exp)
    } else {
      validFrom = template.validFrom
      validTo = template.validTo
    }

    const userCoupon = {
      templateId, userId,
      userOpenid: '',
      couponName: template.name,
      couponType: template.type,
      couponValue: template.value,
      minAmount: template.minAmount,
      scope: template.scope,
      scopeIds: template.scopeIds,
      validFrom, validTo,
      status: 'available',
      usedAt: '', usedOrderId: '',
      source: 'admin_grant',
      grantedBy: grantedBy || '',
      createdAt: now, updatedAt: now,
    }

    const { _id } = await db.collection('user_coupons').add({ data: userCoupon })
    results.push({ ...userCoupon, id: _id })
  }

  // 更新模板已发数
  await db.collection('coupon_templates').doc(templateId).update({
    data: { claimedCount: _.inc(num), updatedAt: now }
  })

  return { success: true, count: num, coupons: results }
}

// --- 批量发放给多个用户 ---
async function batchGrantCoupon(event, now) {
  const { templateId, userIds, count, grantedBy } = event
  if (!templateId || !Array.isArray(userIds) || !userIds.length) return err('参数不完整')

  const { data: template } = await db.collection('coupon_templates').doc(templateId).get()
  if (!template || template.status !== 'active') return err('模板不存在或已停用')

  const perUser = Math.min(Number(count || 1), 10)
  let totalGranted = 0

  for (const userId of userIds) {
    for (let i = 0; i < perUser; i++) {
      let validFrom = '', validTo = ''
      if (template.validDaysAfterClaim > 0) {
        validFrom = now
        const exp = new Date()
        exp.setDate(exp.getDate() + template.validDaysAfterClaim)
        validTo = formatDateTime(exp)
      } else {
        validFrom = template.validFrom
        validTo = template.validTo
      }

      const userCoupon = {
        templateId, userId, userOpenid: '',
        couponName: template.name, couponType: template.type,
        couponValue: template.value, minAmount: template.minAmount,
        scope: template.scope, scopeIds: template.scopeIds,
        validFrom, validTo, status: 'available',
        usedAt: '', usedOrderId: '',
        source: 'admin_grant', grantedBy: grantedBy || '',
        createdAt: now, updatedAt: now,
      }

      await db.collection('user_coupons').add({ data: userCoupon })
      totalGranted++
    }
  }

  await db.collection('coupon_templates').doc(templateId).update({
    data: { claimedCount: _.inc(totalGranted), updatedAt: now }
  })

  return { success: true, totalGranted }
}

// --- 停用用户优惠券 ---
async function disableUserCoupon(event, now) {
  const { userCouponId } = event
  if (!userCouponId) return err('缺少优惠券 ID')

  const { data: coupon } = await db.collection('user_coupons').doc(userCouponId).get()
  if (!coupon) return err('优惠券不存在')
  if (coupon.status === 'used') return err('已使用的优惠券不可停用')

  await db.collection('user_coupons').doc(userCouponId).update({
    data: { status: 'disabled', updatedAt: now }
  })

  return { success: true }
}

// --- 用户领取优惠券 ---
async function claimCoupon(event, now) {
  const { templateId } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return err('请先登录')

  const { data: template } = await db.collection('coupon_templates').doc(templateId).get()
  if (!template || template.status !== 'active') return err('优惠券不存在或已停用')
  if (template.distributeMethod !== 'user_claim') return err('该优惠券不支持用户领取')

  // 检查配额
  if (template.totalQuota > 0 && template.claimedCount >= template.totalQuota) {
    return err('优惠券已领完')
  }

  // 检查有效期
  if (template.validTo && template.validTo < now) return err('优惠券已过期')

  // 查找用户
  const { data: users } = await db.collection('users').where({ _openid: openid }).limit(1).get()
  const user = users?.[0]
  if (!user) return err('用户不存在')

  // 检查每人限领
  if (template.perUserLimit > 0) {
    const { data: existing } = await db.collection('user_coupons')
      .where({ userId: user._id, templateId })
      .count()
    if (existing >= template.perUserLimit) return err('已达到领取上限')
  }

  // 计算有效期
  let validFrom = '', validTo = ''
  if (template.validDaysAfterClaim > 0) {
    validFrom = now
    const exp = new Date()
    exp.setDate(exp.getDate() + template.validDaysAfterClaim)
    validTo = formatDateTime(exp)
  } else {
    validFrom = template.validFrom
    validTo = template.validTo
  }

  const userCoupon = {
    templateId, userId: user._id, userOpenid: openid,
    couponName: template.name, couponType: template.type,
    couponValue: template.value, minAmount: template.minAmount,
    scope: template.scope, scopeIds: template.scopeIds,
    validFrom, validTo, status: 'available',
    usedAt: '', usedOrderId: '',
    source: 'user_claim', grantedBy: '',
    createdAt: now, updatedAt: now,
  }

  const { _id } = await db.collection('user_coupons').add({ data: userCoupon })

  // 原子更新模板已领数
  await db.collection('coupon_templates').doc(templateId).update({
    data: { claimedCount: _.inc(1), updatedAt: now }
  })

  return { success: true, coupon: { ...userCoupon, id: _id } }
}

// --- 路由 ---
exports.main = async (event) => {
  const now = formatDateTime(new Date())
  const wxContext = cloud.getWXContext()

  switch (event.action) {
    case 'createTemplate': return createTemplate(event, now)
    case 'updateTemplate': return updateTemplate(event, now)
    case 'grantCoupon': return grantCoupon(event, now, wxContext.OPENID)
    case 'batchGrantCoupon': return batchGrantCoupon(event, now)
    case 'disableUserCoupon': return disableUserCoupon(event, now)
    case 'claimCoupon': return claimCoupon(event, now)
    default: return err(`未知操作: ${event.action}`)
  }
}
