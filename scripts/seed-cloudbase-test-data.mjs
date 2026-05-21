#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ENV_ID = 'cloud1-d7g7ctn4m86bada89'
const SEED_BATCH = 'dxdy-admin-smoke-20260521'
const ADMIN_ID = 'seed_admin_system'
const ADMIN_NAME = 'DXDY Seed Admin'

const permissionsAll = {
  view_dashboard: true,
  manage_products: true,
  manage_orders: true,
  order_price_adjust: true,
  order_assign: true,
  manage_returns: true,
  return_review: true,
  manage_users: true,
  manage_accounts: true,
  manage_roles: true,
  manage_system: true,
  manage_finance: true,
  withdrawal_review: true,
  invoice_process: true,
  view_logs: true,
}

const args = new Set(process.argv.slice(2))
const mode =
  args.has('--cleanup') ? 'cleanup'
    : args.has('--verify') ? 'verify'
      : 'seed'
const dryRun = args.has('--dry-run')

let resolvedTcbEntry = ''

function tcbCommand() {
  return 'tcb'
}

function resolveTcbEntry() {
  if (resolvedTcbEntry) return resolvedTcbEntry
  const candidates = []
  if (process.platform === 'win32') {
    const where = spawnSync('where.exe', ['tcb.cmd'], { encoding: 'utf8' })
    for (const line of String(where.stdout || '').split(/\r?\n/).filter(Boolean)) {
      candidates.push(path.join(path.dirname(line), 'node_modules', '@cloudbase', 'cli', 'bin', 'tcb'))
    }
  }
  candidates.push(path.join(process.cwd(), 'node_modules', '@cloudbase', 'cli', 'bin', 'tcb'))
  const found = candidates.find(candidate => existsSync(candidate))
  if (!found) throw new Error('Cannot find @cloudbase/cli bin/tcb entry')
  resolvedTcbEntry = found
  return found
}

function runTcb(tcbArgs, options = {}) {
  if (dryRun) {
    console.log(`[dry-run] tcb ${tcbArgs.join(' ')}`)
    return ''
  }
  const result = process.platform === 'win32'
    ? spawnSync(process.execPath, [
        resolveTcbEntry(),
        ...tcbArgs,
      ], {
        cwd: process.cwd(),
        encoding: 'utf8',
        shell: false,
        maxBuffer: 1024 * 1024 * 10,
      })
    : spawnSync(tcbCommand(), tcbArgs, {
        cwd: process.cwd(),
        encoding: 'utf8',
        shell: false,
        maxBuffer: 1024 * 1024 * 10,
      })
  if (result.error) throw result.error
  const output = `${result.stdout || ''}${result.stderr || ''}`
  if (result.status !== 0) {
    throw new Error(`tcb ${tcbArgs.join(' ')} failed:\n${output}`)
  }
  if (options.print !== false && output.trim()) console.log(output.trim())
  return output
}

function executeCommands(commands, options = {}) {
  if (commands.length === 0) return ''
  return runTcb([
    '-e',
    ENV_ID,
    'db',
    'nosql',
    'execute',
    '--command',
    JSON.stringify(commands),
    '--json',
  ], options)
}

function fnInvoke(name, data) {
  const output = runTcb([
    '-e',
    ENV_ID,
    'fn',
    'invoke',
    name,
    '-d',
    JSON.stringify(data),
    '--json',
  ], { print: false })
  const parsed = parseJsonFromOutput(output)
  const payload = parsed?.Result
    ? parseJsonFromOutput(parsed.Result)
    : parsed?.data?.RetMsg
      ? parseJsonFromOutput(parsed.data.RetMsg)
      : parsed
  if (!payload?.success) {
    throw new Error(`${name} failed: ${JSON.stringify(payload || output)}`)
  }
  return payload
}

function parseJsonFromOutput(output) {
  const text = String(output || '').trim()
  if (!text) return null
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first < 0 || last < first) return null
  try {
    return JSON.parse(text.slice(first, last + 1))
  } catch {
    return null
  }
}

function doc(id, data) {
  return {
    _id: id,
    seedBatch: SEED_BATCH,
    ...data,
  }
}

function dt(dayOffset, hour, minute = 0) {
  const base = new Date('2026-05-21T00:00:00+08:00')
  base.setDate(base.getDate() + dayOffset)
  base.setHours(hour, minute, 0, 0)
  const y = base.getFullYear()
  const m = String(base.getMonth() + 1).padStart(2, '0')
  const d = String(base.getDate()).padStart(2, '0')
  const hh = String(base.getHours()).padStart(2, '0')
  const mm = String(base.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

function iso(dayOffset, hour, minute = 0) {
  return dt(dayOffset, hour, minute).replace(' ', 'T') + ':00+08:00'
}

function address(name = '广州联合动物医院') {
  return {
    name,
    phone: '13926001122',
    province: '广东省',
    city: '广州市',
    district: '天河区',
    detail: '珠江新城华穗路88号宠物急诊中心',
    full: '广东省广州市天河区珠江新城华穗路88号宠物急诊中心',
    isDefault: true,
  }
}

function pricing(originalAmount, actualAmount, extra = {}) {
  const couponDiscount = extra.coupon?.discountAmount || 0
  const pointsDeduction = extra.pointsDeduction || 0
  const shippingFee = extra.shippingFee || 0
  const urgentFee = extra.urgentFee || 0
  return {
    originalAmount,
    actualAmount,
    priceLog: extra.priceLog || [],
    shippingFee,
    urgentFee,
    pointsDeduction,
    refundedAmount: extra.refundedAmount || 0,
    ...(extra.coupon ? { coupon: extra.coupon } : {}),
    breakdown: {
      goodsAmount: originalAmount,
      couponDiscount,
      pointsDeduction,
      shippingFee,
      urgentFee,
      actualAmount,
    },
  }
}

function shipping(addr = address(), extra = {}) {
  return {
    address: {
      name: addr.name,
      phone: addr.phone,
      full: addr.full,
    },
    trackingNo: extra.trackingNo || null,
    company: extra.company || null,
    logistics: extra.logistics || [],
    urgent: !!extra.urgent,
    ...(extra.coldChain ? { coldChain: extra.coldChain } : {}),
    ...(extra.abnormal ? { abnormal: extra.abnormal } : {}),
  }
}

const categories = [
  doc('seed_cat_blood', { id: 'seed_cat_blood', name: '血液制品', icon: 'droplet', sort: 1, createdAt: iso(-20, 9), updatedAt: iso(-3, 9) }),
  doc('seed_cat_test', { id: 'seed_cat_test', name: '检测服务', icon: 'microscope', sort: 2, createdAt: iso(-20, 9), updatedAt: iso(-3, 9) }),
  doc('seed_cat_supply', { id: 'seed_cat_supply', name: '冷链耗材', icon: 'package', sort: 3, createdAt: iso(-20, 9), updatedAt: iso(-3, 9) }),
  doc('seed_cat_card', { id: 'seed_cat_card', name: '服务卡券', icon: 'ticket', sort: 4, createdAt: iso(-20, 9), updatedAt: iso(-3, 9) }),
]

const products = [
  doc('seed_prod_blood_a', {
    id: 'seed_prod_blood_a',
    name: '犬用悬浮红细胞 1U',
    description: '经交叉配血建议后使用，适用于犬急性失血和贫血病例。',
    images: ['https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=900'],
    category: '血液制品',
    specs: [{ name: '规格', value: '1U/袋' }, { name: '保存', value: '2-6C冷藏' }],
    institutionPrice: 680,
    personalPrice: 780,
    visibility: 'institution_only',
    stock: 6,
    status: 'on_sale',
    returnPolicy: { enabled: true, deadlineDays: 1, note: '血包仅支持质量问题售后。' },
    isBloodPack: true,
    productType: 'blood_pack',
    urgentConfig: { enabled: true, extraFee: 80, description: '2小时内冷链加急出库' },
    purchaseLimit: { minQuantity: 1, maxQuantityPerOrder: 3, maxQuantityPerUser: 6 },
    agreementRequired: { enabled: true, title: '血液制品使用知情同意', content: '仅供具备资质的机构按诊疗规范使用。' },
    deliveryConfig: { regions: ['广州', '佛山', '深圳'], coldChainRequired: true },
    salesCountEnabled: true,
    promotionPrice: 650,
    promotionStart: iso(-2, 0),
    promotionEnd: iso(6, 23, 59),
    createdAt: iso(-19, 9),
    updatedAt: iso(-1, 17),
  }),
  doc('seed_prod_blood_b', {
    id: 'seed_prod_blood_b',
    name: '猫用全血配型包',
    description: '猫血型筛查与输血前配型组合。',
    images: ['https://images.unsplash.com/photo-1574144611937-0df059b5ef3e?w=900'],
    category: '血液制品',
    specs: [{ name: '规格', value: '配型+运输包' }],
    institutionPrice: 520,
    personalPrice: 620,
    visibility: 'institution_only',
    stock: 3,
    status: 'on_sale',
    returnPolicy: { enabled: true, deadlineDays: 1, note: '血包类仅支持质量问题。' },
    isBloodPack: true,
    productType: 'blood_pack',
    urgentConfig: { enabled: true, extraFee: 120, description: '夜间加急' },
    deliveryConfig: { regions: ['广州', '东莞'], coldChainRequired: true },
    createdAt: iso(-18, 10),
    updatedAt: iso(-1, 16),
  }),
  doc('seed_prod_test_cbc', {
    id: 'seed_prod_test_cbc',
    name: '犬猫术前生化检测套餐',
    description: '血常规、生化、凝血基础项目，支持报告追溯。',
    images: ['https://images.unsplash.com/photo-1581093458791-9d2f0f0f6c85?w=900'],
    category: '检测服务',
    specs: [{ name: '报告时效', value: '24小时' }],
    institutionPrice: 198,
    personalPrice: 238,
    visibility: 'all',
    stock: 999,
    status: 'on_sale',
    returnPolicy: { enabled: false, deadlineDays: 0, note: '检测服务预约后不支持无理由退款。' },
    productType: 'test_service',
    bookingConfig: { enabled: true, leadDays: 1, locations: ['广州实验室', '深圳采样点'], requireInstitution: false, requireVerification: false },
    createdAt: iso(-17, 11),
    updatedAt: iso(-1, 16),
  }),
  doc('seed_prod_card', {
    id: 'seed_prod_card',
    name: '年度血型检测卡 5次',
    description: '适合连锁宠物医院门店间转赠和核销。',
    images: ['https://images.unsplash.com/photo-1580281657527-47f249e8f4df?w=900'],
    category: '服务卡券',
    specs: [{ name: '次数', value: '5次' }],
    institutionPrice: 888,
    personalPrice: 998,
    visibility: 'institution_only',
    stock: 80,
    status: 'on_sale',
    returnPolicy: { enabled: true, deadlineDays: 7, note: '未核销可申请退款。' },
    productType: 'card_voucher',
    redeemableCategory: '血型检测',
    validDays: 365,
    createdAt: iso(-16, 13),
    updatedAt: iso(-1, 16),
  }),
  doc('seed_prod_supply', {
    id: 'seed_prod_supply',
    name: '冷链转运保温箱',
    description: '适用于样本和血制品短途转运。',
    images: ['https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=900'],
    category: '冷链耗材',
    specs: [{ name: '容量', value: '8L' }],
    institutionPrice: 168,
    personalPrice: 188,
    visibility: 'all',
    stock: 32,
    status: 'on_sale',
    returnPolicy: { enabled: true, deadlineDays: 7, note: '未使用可退换。' },
    productType: 'physical',
    deliveryConfig: { regions: ['全国'], coldChainRequired: false },
    createdAt: iso(-15, 13),
    updatedAt: iso(-1, 16),
  }),
]

const users = [
  doc(ADMIN_ID, {
    username: 'dxdy_admin',
    password: '***',
    realName: ADMIN_NAME,
    nickname: ADMIN_NAME,
    phone: '13800000001',
    avatar: '',
    role: 'system_admin',
    permissions: permissionsAll,
    status: 'active',
    createdAt: iso(-30, 9),
    updatedAt: iso(-1, 9),
  }),
  doc('seed_admin_service', {
    username: 'dxdy_service',
    password: '***',
    realName: '客服值班',
    nickname: '客服值班',
    phone: '13800000002',
    avatar: '',
    role: 'service',
    permissions: {
      view_dashboard: true,
      manage_orders: true,
      manage_returns: true,
      manage_finance: true,
      withdrawal_review: true,
      invoice_process: true,
      order_price_adjust: true,
      order_assign: true,
      return_review: true,
    },
    status: 'active',
    createdAt: iso(-29, 9),
    updatedAt: iso(-1, 9),
  }),
  doc('seed_admin_product', {
    username: 'dxdy_product',
    password: '***',
    realName: '商品运营',
    nickname: '商品运营',
    phone: '13800000003',
    avatar: '',
    role: 'product_manager',
    permissions: { view_dashboard: true, manage_products: true },
    status: 'active',
    createdAt: iso(-28, 9),
    updatedAt: iso(-1, 9),
  }),
  doc('seed_customer_hospital_a', {
    phone: '13888002233',
    nickname: '广州联合动物医院',
    avatar: '',
    role: 'customer',
    customerType: 'institution',
    verificationStatus: 'approved',
    verificationInfo: { businessLicense: 'MA-DXDY-2026-001', contactName: '林医生', contactPhone: '13888002233' },
    boundSalespersonId: 'seed_salesperson_chen',
    salespersonId: 'seed_salesperson_chen',
    wallet: { balance: 1260, rechargeHistory: [{ id: 'seed_recharge_hist_1', amount: 1000, bonus: 100, createdAt: iso(-5, 10) }] },
    points: { balance: 620, history: [{ id: 'seed_points_1', change: 120, balance: 620, reason: '订单完成奖励', createdAt: iso(-2, 16) }] },
    addresses: [address()],
    referralCode: 'GZPET01',
    createdAt: iso(-21, 8),
    updatedAt: iso(-1, 12),
  }),
  doc('seed_customer_hospital_b', {
    phone: '13821003456',
    nickname: '深圳瑞鹏急诊中心',
    avatar: '',
    role: 'customer',
    customerType: 'institution',
    verificationStatus: 'pending',
    verificationInfo: { businessLicense: 'SZ-RP-2026-019', contactName: '周院长', contactPhone: '13821003456' },
    boundSalespersonId: 'seed_salesperson_chen',
    salespersonId: 'seed_salesperson_chen',
    wallet: { balance: 300, rechargeHistory: [] },
    points: { balance: 80, history: [] },
    addresses: [address('深圳瑞鹏急诊中心')],
    referralCode: 'SZRP19',
    agentStatus: 'pending_review',
    agentApplication: { realName: '周院长', submittedAt: iso(-1, 10), note: '申请成为区域代理' },
    createdAt: iso(-10, 8),
    updatedAt: iso(-1, 10),
  }),
  doc('seed_customer_personal', {
    phone: '13811001234',
    nickname: '陈小姐',
    avatar: '',
    role: 'customer',
    customerType: 'personal',
    verificationStatus: 'none',
    boundSalespersonId: 'seed_salesperson_wu',
    salespersonId: 'seed_salesperson_wu',
    wallet: { balance: 88, rechargeHistory: [] },
    points: { balance: 260, history: [] },
    addresses: [address('陈小姐')],
    referralCode: 'PETC88',
    createdAt: iso(-12, 14),
    updatedAt: iso(-1, 10),
  }),
  doc('seed_salesperson_chen', {
    phone: '13833007890',
    nickname: '陈启航',
    realName: '陈启航',
    avatar: '',
    role: 'salesperson',
    verificationStatus: 'approved',
    verificationInfo: { realName: '陈启航', idCard: '440100198805210011' },
    commission: { total: 4380, available: 2860, withdrawn: 900, pendingDeduction: 0 },
    bankCards: [{ id: 'seed_bank_1', bankName: '招商银行', cardNo: '6225888888886789', holderName: '陈启航' }],
    customers: ['seed_customer_hospital_a', 'seed_customer_hospital_b'],
    createdAt: iso(-40, 9),
    updatedAt: iso(-1, 9),
  }),
  doc('seed_salesperson_wu', {
    phone: '13900008888',
    nickname: '吴敏',
    realName: '吴敏',
    avatar: '',
    role: 'salesperson',
    verificationStatus: 'approved',
    verificationInfo: { realName: '吴敏', idCard: '440300199201012222' },
    commission: { total: 1580, available: 780, withdrawn: 500, pendingDeduction: 80 },
    bankCards: [{ id: 'seed_bank_2', bankName: '中国银行', cardNo: '6216666666661357', holderName: '吴敏' }],
    customers: ['seed_customer_personal'],
    createdAt: iso(-38, 9),
    updatedAt: iso(-1, 9),
  }),
  doc('seed_clerk_li', {
    phone: '13900001111',
    nickname: '李制单',
    realName: '李制单',
    avatar: '',
    role: 'clerk',
    assignedOrderIds: ['seed_order_ship_ready'],
    createdAt: iso(-34, 9),
    updatedAt: iso(-1, 9),
  }),
  doc('seed_clerk_zhao', {
    phone: '13900002222',
    nickname: '赵制单',
    realName: '赵制单',
    avatar: '',
    role: 'clerk',
    assignedOrderIds: [],
    createdAt: iso(-34, 10),
    updatedAt: iso(-1, 9),
  }),
]

const orders = [
  doc('seed_order_pay_pending', {
    id: 'seed_order_pay_pending',
    orderNo: 'DX202605210001',
    type: 'normal',
    status: 'pending_payment',
    customerId: 'seed_customer_hospital_a',
    customerName: '广州联合动物医院',
    customerOpenid: 'seed_openid_hospital_a',
    salespersonId: 'seed_salesperson_chen',
    clerkId: null,
    items: [{ productId: 'seed_prod_supply', productName: '冷链转运保温箱', productImage: products[4].images[0], spec: '8L', quantity: 2, unitPrice: 168, totalPrice: 336 }],
    pricing: pricing(336, 316, { coupon: { userCouponId: 'seed_user_coupon_used', couponName: '术前检测立减券', couponType: 'fixed', discountAmount: 20 } }),
    shipping: shipping(),
    returnRecordId: null,
    commission: { status: 'pending', amount: 31.6, settledAt: null },
    remark: '待支付订单，用于后台改价/取消验证。',
    createdAt: iso(0, 8, 20),
    updatedAt: iso(0, 8, 50),
  }),
  doc('seed_order_assign_ready', {
    id: 'seed_order_assign_ready',
    orderNo: 'DX202605210002',
    type: 'normal',
    status: 'pending_shipment',
    customerId: 'seed_customer_hospital_a',
    customerName: '广州联合动物医院',
    customerOpenid: 'seed_openid_hospital_a',
    salespersonId: 'seed_salesperson_chen',
    clerkId: null,
    items: [{ productId: 'seed_prod_blood_a', productName: '犬用悬浮红细胞 1U', productImage: products[0].images[0], spec: '1U/袋', quantity: 1, unitPrice: 650, totalPrice: 650 }],
    pricing: pricing(680, 730, { shippingFee: 0, urgentFee: 80 }),
    shipping: shipping(address(), { urgent: true }),
    returnRecordId: null,
    commission: { status: 'locked', amount: 73, settledAt: null },
    remark: '待指派制单员。',
    createdAt: iso(0, 9, 10),
    updatedAt: iso(0, 9, 20),
  }),
  doc('seed_order_ship_ready', {
    id: 'seed_order_ship_ready',
    orderNo: 'DX202605210003',
    type: 'normal',
    status: 'pending_shipment',
    customerId: 'seed_customer_hospital_a',
    customerName: '广州联合动物医院',
    customerOpenid: 'seed_openid_hospital_a',
    salespersonId: 'seed_salesperson_chen',
    clerkId: 'seed_clerk_li',
    items: [{ productId: 'seed_prod_blood_b', productName: '猫用全血配型包', productImage: products[1].images[0], spec: '配型+运输包', quantity: 1, unitPrice: 520, totalPrice: 520 }],
    pricing: pricing(520, 640, { urgentFee: 120 }),
    shipping: shipping(address(), { urgent: true }),
    returnRecordId: null,
    commission: { status: 'locked', amount: 64, settledAt: null },
    remark: '待发货订单，用于冷链发货验证。',
    createdAt: iso(0, 9, 40),
    updatedAt: iso(0, 9, 50),
  }),
  doc('seed_order_receipt', {
    id: 'seed_order_receipt',
    orderNo: 'DX202605200004',
    type: 'normal',
    status: 'pending_receipt',
    customerId: 'seed_customer_personal',
    customerName: '陈小姐',
    customerOpenid: 'seed_openid_personal',
    salespersonId: 'seed_salesperson_wu',
    clerkId: 'seed_clerk_li',
    items: [{ productId: 'seed_prod_supply', productName: '冷链转运保温箱', productImage: products[4].images[0], spec: '8L', quantity: 1, unitPrice: 188, totalPrice: 188 }],
    pricing: pricing(188, 188),
    shipping: shipping(address('陈小姐'), {
      trackingNo: 'SF126605200004',
      company: '顺丰速运',
      logistics: [{ time: dt(-1, 16), description: '已揽收', location: '广州仓' }],
    }),
    returnRecordId: null,
    commission: { status: 'settled', amount: 18.8, settledAt: iso(-1, 18) },
    createdAt: iso(-1, 15),
    updatedAt: iso(-1, 16),
  }),
  doc('seed_order_completed_returnable', {
    id: 'seed_order_completed_returnable',
    orderNo: 'DX202605190005',
    type: 'normal',
    status: 'completed',
    customerId: 'seed_customer_hospital_a',
    customerName: '广州联合动物医院',
    customerOpenid: 'seed_openid_hospital_a',
    salespersonId: 'seed_salesperson_chen',
    clerkId: 'seed_clerk_li',
    items: [{ productId: 'seed_prod_blood_a', productName: '犬用悬浮红细胞 1U', productImage: products[0].images[0], spec: '1U/袋', quantity: 2, unitPrice: 650, totalPrice: 1300 }],
    pricing: pricing(1360, 1380, { urgentFee: 80, refundedAmount: 0 }),
    shipping: shipping(address(), {
      trackingNo: 'SF126605190005',
      company: '顺丰冷运',
      logistics: [{ time: dt(-2, 16), description: '客户已签收', location: '广州天河' }],
      coldChain: { packageType: '冷藏箱', method: '冰袋2-6C', weight: '3.2kg', boxTemperature: '4.1' },
    }),
    returnRecordId: 'seed_return_pending',
    commission: { status: 'settled', amount: 138, settledAt: iso(-1, 12) },
    completedAt: iso(-2, 18),
    createdAt: iso(-2, 10),
    updatedAt: iso(-2, 18),
  }),
  doc('seed_order_booking_confirm', {
    id: 'seed_order_booking_confirm',
    orderNo: 'DX202605210006',
    type: 'booking',
    status: 'pending_confirmation',
    customerId: 'seed_customer_hospital_b',
    customerName: '深圳瑞鹏急诊中心',
    customerOpenid: 'seed_openid_hospital_b',
    salespersonId: 'seed_salesperson_chen',
    clerkId: null,
    items: [{ productId: 'seed_prod_test_cbc', productName: '犬猫术前生化检测套餐', productImage: products[2].images[0], spec: '24小时', quantity: 3, unitPrice: 198, totalPrice: 594 }],
    pricing: pricing(594, 594),
    shipping: shipping(address('深圳瑞鹏急诊中心')),
    booking: { date: '2026-05-23', location: '深圳采样点', contactName: '周院长', contactPhone: '13821003456' },
    returnRecordId: null,
    commission: { status: 'pending', amount: 59.4, settledAt: null },
    createdAt: iso(0, 11),
    updatedAt: iso(0, 11, 10),
  }),
  doc('seed_order_recharge', {
    id: 'seed_order_recharge',
    orderNo: 'RC202605210001',
    type: 'recharge',
    status: 'completed',
    customerId: 'seed_customer_hospital_a',
    customerName: '广州联合动物医院',
    amount: 1000,
    rechargeTier: { amount: 1000, bonus: 100, label: '测试充值1000送100' },
    pricing: pricing(1000, 1000),
    shipping: shipping(),
    items: [],
    salespersonId: '',
    clerkId: null,
    returnRecordId: null,
    commission: { status: 'none', amount: 0, settledAt: null },
    paidAt: iso(0, 12),
    createdAt: iso(0, 11, 55),
    updatedAt: iso(0, 12),
  }),
]

const returns = [
  doc('seed_return_pending', {
    id: 'seed_return_pending',
    afterNo: 'RT202605210001',
    orderId: 'seed_order_completed_returnable',
    customerId: 'seed_customer_hospital_a',
    customerOpenid: 'seed_openid_hospital_a',
    type: 'refund_return',
    status: 'pending_review',
    reasonType: 'quality',
    reason: '血袋外包装温度记录贴异常，申请质量复核。',
    items: [{ productId: 'seed_prod_blood_a', productName: '犬用悬浮红细胞 1U', quantity: 1, unitPrice: 650 }],
    refundAmount: 690,
    sendLogistics: null,
    receiveLogistics: null,
    verificationResult: 'pending',
    commissionAdjust: { amount: 0, reason: '' },
    reviewerId: null,
    reviewNote: '',
    timeline: [{ status: 'pending_review', title: '售后申请已提交', time: dt(0, 10, 30), desc: '等待后台审核' }],
    createdAt: iso(0, 10, 30),
    updatedAt: iso(0, 10, 30),
  }),
  doc('seed_return_refunding', {
    id: 'seed_return_refunding',
    afterNo: 'RT202605200002',
    orderId: 'seed_order_receipt',
    customerId: 'seed_customer_personal',
    customerOpenid: 'seed_openid_personal',
    type: 'refund_only',
    status: 'refunding',
    reasonType: 'other',
    reason: '客户重复下单，客服确认差额退款。',
    items: [{ productId: 'seed_prod_supply', productName: '冷链转运保温箱', quantity: 1, unitPrice: 188 }],
    refundAmount: 38,
    sendLogistics: null,
    receiveLogistics: null,
    verificationResult: 'qualified',
    commissionAdjust: { amount: 3.8, reason: '差额退款扣回部分提成' },
    reviewerId: ADMIN_ID,
    reviewNote: '同意退款',
    timeline: [],
    createdAt: iso(-1, 18),
    updatedAt: iso(0, 9),
  }),
  doc('seed_return_exchange', {
    id: 'seed_return_exchange',
    afterNo: 'RT202605200003',
    orderId: 'seed_order_receipt',
    customerId: 'seed_customer_personal',
    customerOpenid: 'seed_openid_personal',
    type: 'exchange',
    status: 'received',
    reasonType: 'quality',
    reason: '保温箱锁扣松动，客户寄回换货。',
    items: [{ productId: 'seed_prod_supply', productName: '冷链转运保温箱', quantity: 1, unitPrice: 188 }],
    refundAmount: 0,
    exchangeItem: { productId: 'seed_prod_supply', productName: '冷链转运保温箱', spec: '8L', quantity: 1, unitPrice: 188 },
    sendLogistics: { company: '顺丰速运', trackingNo: 'SFRT200003' },
    receiveLogistics: null,
    verificationResult: 'pending',
    commissionAdjust: { amount: 0, reason: '' },
    reviewerId: ADMIN_ID,
    reviewNote: '已收货待质检',
    timeline: [],
    createdAt: iso(-1, 17),
    updatedAt: iso(0, 8),
  }),
]

const withdrawals = [
  doc('seed_withdraw_pending', {
    id: 'seed_withdraw_pending',
    salespersonId: 'seed_salesperson_chen',
    amount: 600,
    bankName: '招商银行',
    cardNo: '6225888888886789',
    status: 'pending_review',
    appliedAt: iso(0, 9),
    createdAt: iso(0, 9),
    updatedAt: iso(0, 9),
  }),
  doc('seed_withdraw_approved', {
    id: 'seed_withdraw_approved',
    salespersonId: 'seed_salesperson_wu',
    amount: 300,
    bankName: '中国银行',
    cardNo: '6216666666661357',
    status: 'approved',
    appliedAt: iso(-1, 14),
    reviewedAt: iso(-1, 17),
    reviewNote: '资料匹配',
    createdAt: iso(-1, 14),
    updatedAt: iso(-1, 17),
  }),
  doc('seed_withdraw_paid', {
    id: 'seed_withdraw_paid',
    salespersonId: 'seed_salesperson_chen',
    amount: 900,
    bankName: '招商银行',
    cardNo: '6225888888886789',
    status: 'paid',
    appliedAt: iso(-5, 10),
    completedAt: iso(-4, 16),
    createdAt: iso(-5, 10),
    updatedAt: iso(-4, 16),
  }),
]

const invoices = [
  doc('seed_invoice_pending', {
    id: 'seed_invoice_pending',
    orderId: 'seed_order_completed_returnable',
    orderNo: 'DX202605190005',
    invoiceType: 'electronic',
    title: '广州联合动物医院有限公司',
    taxNo: '91440101MA5DXDY001',
    amount: 1380,
    email: 'finance@gzpet.example',
    status: 'pending',
    createdAt: iso(0, 9, 30),
    updatedAt: iso(0, 9, 30),
  }),
  doc('seed_invoice_paper', {
    id: 'seed_invoice_paper',
    orderId: 'seed_order_receipt',
    orderNo: 'DX202605200004',
    invoiceType: 'paper',
    title: '陈小姐',
    amount: 188,
    email: 'chen@example.com',
    status: 'pending',
    createdAt: iso(0, 10),
    updatedAt: iso(0, 10),
  }),
  doc('seed_invoice_issued', {
    id: 'seed_invoice_issued',
    orderId: 'seed_order_recharge',
    orderNo: 'RC202605210001',
    invoiceType: 'electronic',
    title: '广州联合动物医院有限公司',
    amount: 1000,
    email: 'finance@gzpet.example',
    status: 'issued',
    invoiceNo: 'INV202605210001',
    invoiceFileID: 'cloud://cloud1-d7g7ctn4m86bada89.seed/invoice.pdf',
    createdAt: iso(-1, 13),
    updatedAt: iso(0, 8),
  }),
]

const commissionRecords = [
  doc('seed_commission_pending', { id: 'seed_commission_pending', salespersonId: 'seed_salesperson_chen', customerId: 'seed_customer_hospital_b', orderId: 'seed_order_booking_confirm', orderNo: 'DX202605210006', amount: 59.4, status: 'pending', sourceType: 'order', description: '预约检测订单待结算提成', createdAt: iso(0, 11), updatedAt: iso(0, 11) }),
  doc('seed_commission_locked', { id: 'seed_commission_locked', salespersonId: 'seed_salesperson_chen', customerId: 'seed_customer_hospital_a', orderId: 'seed_order_assign_ready', orderNo: 'DX202605210002', amount: 73, status: 'locked', sourceType: 'order', description: '血包订单锁定提成', createdAt: iso(0, 9, 10), updatedAt: iso(0, 9, 20) }),
  doc('seed_commission_settled', { id: 'seed_commission_settled', salespersonId: 'seed_salesperson_chen', customerId: 'seed_customer_hospital_a', orderId: 'seed_order_completed_returnable', orderNo: 'DX202605190005', amount: 138, status: 'settled', sourceType: 'order', description: '订单完成已结算', createdAt: iso(-2, 18), updatedAt: iso(-1, 12) }),
  doc('seed_commission_deducted', { id: 'seed_commission_deducted', salespersonId: 'seed_salesperson_wu', customerId: 'seed_customer_personal', orderId: 'seed_order_receipt', orderNo: 'DX202605200004', amount: 3.8, status: 'deducted', sourceType: 'return', description: '退款扣回', createdAt: iso(-1, 18), updatedAt: iso(0, 9) }),
]

const couponTemplates = [
  doc('seed_coupon_template_fixed', { id: 'seed_coupon_template_fixed', name: '新客检测立减20', description: '检测服务满100立减20', type: 'fixed', value: 20, minAmount: 100, scope: 'categories', scopeIds: ['seed_cat_test'], distributeMethod: 'admin', totalQuota: 500, claimedCount: 2, perUserLimit: 1, validDaysAfterClaim: 30, validFrom: iso(-10, 0), validTo: iso(20, 23, 59), status: 'active', createdAt: iso(-10, 9), updatedAt: iso(-1, 9) }),
  doc('seed_coupon_template_full', { id: 'seed_coupon_template_full', name: '血制品满1000减80', description: '机构血制品专属券', type: 'full_reduction', value: 80, minAmount: 1000, scope: 'products', scopeIds: ['seed_prod_blood_a', 'seed_prod_blood_b'], distributeMethod: 'user_claim', totalQuota: 120, claimedCount: 1, perUserLimit: 1, validDaysAfterClaim: 15, validFrom: iso(-5, 0), validTo: iso(10, 23, 59), status: 'active', createdAt: iso(-5, 9), updatedAt: iso(-1, 9) }),
]

const userCoupons = [
  doc('seed_user_coupon_available', { id: 'seed_user_coupon_available', templateId: 'seed_coupon_template_full', userId: 'seed_customer_hospital_a', userOpenid: 'seed_openid_hospital_a', couponName: '血制品满1000减80', couponType: 'full_reduction', couponValue: 80, minAmount: 1000, scope: 'products', scopeIds: ['seed_prod_blood_a', 'seed_prod_blood_b'], validFrom: iso(-1, 0), validTo: iso(10, 23, 59), status: 'available', usedAt: '', usedOrderId: '', source: 'admin_grant', grantedBy: ADMIN_ID, createdAt: iso(-1, 9), updatedAt: iso(-1, 9) }),
  doc('seed_user_coupon_used', { id: 'seed_user_coupon_used', templateId: 'seed_coupon_template_fixed', userId: 'seed_customer_hospital_a', userOpenid: 'seed_openid_hospital_a', couponName: '术前检测立减券', couponType: 'fixed', couponValue: 20, minAmount: 100, scope: 'categories', scopeIds: ['seed_cat_test'], validFrom: iso(-8, 0), validTo: iso(20, 23, 59), status: 'used', usedAt: iso(0, 8, 20), usedOrderId: 'seed_order_pay_pending', source: 'admin_grant', grantedBy: ADMIN_ID, createdAt: iso(-8, 9), updatedAt: iso(0, 8, 20) }),
]

const cardVouchers = [
  doc('seed_card_ungifted', { id: 'seed_card_ungifted', cardNo: 'DXCARD202605210001', status: 'ungifted', purchaseOrderId: 'seed_order_recharge', purchaseOrderNo: 'RC202605210001', productId: 'seed_prod_card', productName: '年度血型检测卡 5次', productImage: products[3].images[0], redeemableCategory: '血型检测', validDays: 365, expiresAt: iso(365, 23, 59), purchaserId: 'seed_customer_hospital_a', purchaserName: '广州联合动物医院', purchaserOpenid: 'seed_openid_hospital_a', currentHolderId: null, currentHolderName: '', giftHistory: [], redeemedOrderId: '', redeemedProductId: '', redeemedProductName: '', redeemedAt: '', verifiedAt: '', voidedAt: '', voidedBy: '', voidReason: '', createdAt: iso(0, 12), updatedAt: iso(0, 12) }),
  doc('seed_card_gifted', { id: 'seed_card_gifted', cardNo: 'DXCARD202605210002', status: 'gifted', purchaseOrderId: 'seed_order_recharge', purchaseOrderNo: 'RC202605210001', productId: 'seed_prod_card', productName: '年度血型检测卡 5次', productImage: products[3].images[0], redeemableCategory: '血型检测', validDays: 365, expiresAt: iso(365, 23, 59), purchaserId: 'seed_customer_hospital_a', purchaserName: '广州联合动物医院', purchaserOpenid: 'seed_openid_hospital_a', currentHolderId: 'seed_customer_hospital_b', currentHolderName: '深圳瑞鹏急诊中心', giftHistory: [{ fromUserId: 'seed_customer_hospital_a', fromUserName: '广州联合动物医院', toUserId: 'seed_customer_hospital_b', toUserName: '深圳瑞鹏急诊中心', at: iso(0, 13) }], redeemedOrderId: '', redeemedProductId: '', redeemedProductName: '', redeemedAt: '', verifiedAt: '', voidedAt: '', voidedBy: '', voidReason: '', createdAt: iso(0, 12), updatedAt: iso(0, 13) }),
  doc('seed_card_redeemed', { id: 'seed_card_redeemed', cardNo: 'DXCARD202605190003', status: 'redeemed', purchaseOrderId: 'seed_order_recharge', purchaseOrderNo: 'RC202605210001', productId: 'seed_prod_card', productName: '年度血型检测卡 5次', productImage: products[3].images[0], redeemableCategory: '血型检测', validDays: 365, expiresAt: iso(365, 23, 59), purchaserId: 'seed_customer_hospital_a', purchaserName: '广州联合动物医院', purchaserOpenid: 'seed_openid_hospital_a', currentHolderId: 'seed_customer_hospital_a', currentHolderName: '广州联合动物医院', giftHistory: [], redeemedOrderId: 'seed_order_booking_confirm', redeemedProductId: 'seed_prod_test_cbc', redeemedProductName: '犬猫术前生化检测套餐', redeemedAt: iso(-1, 14), verifiedAt: '', voidedAt: '', voidedBy: '', voidReason: '', createdAt: iso(-2, 12), updatedAt: iso(-1, 14) }),
]

const testReports = [
  doc('seed_report_ready', { id: 'seed_report_ready', reportNo: 'RPT202605210001', orderId: 'seed_order_completed_returnable', productName: '犬用悬浮红细胞 1U', petName: 'Lucky', species: '犬', sampleNo: 'SMP202605210001', bloodPackCode: 'BP-GZ-20260521-001', status: 'published', conclusion: '交叉配血相容，建议按临床评估输注。', metrics: [{ name: '血型', value: 'DEA 1.1+', unit: '', reference: '-' }, { name: '溶血指数', value: '阴性', unit: '', reference: '阴性' }], createdAt: iso(0, 10), updatedAt: iso(0, 12) }),
  doc('seed_report_draft', { id: 'seed_report_draft', reportNo: 'RPT202605210002', orderId: 'seed_order_booking_confirm', productName: '犬猫术前生化检测套餐', petName: 'Momo', species: '猫', sampleNo: 'SMP202605210002', status: 'draft', conclusion: '样本已接收，待复核。', metrics: [{ name: 'ALT', value: '68', unit: 'U/L', reference: '10-100' }], createdAt: iso(0, 11), updatedAt: iso(0, 11) }),
]

const productReviews = [
  doc('seed_review_pending', { id: 'seed_review_pending', orderId: 'seed_order_completed_returnable', productId: 'seed_prod_blood_a', productName: '犬用悬浮红细胞 1U', productImage: products[0].images[0], userId: 'seed_customer_hospital_a', userNickname: '广州联合动物医院', rating: 5, content: '冷链到货及时，温控记录完整，急诊使用很顺畅。', images: [], status: 'pending', adminReply: '', createdAt: iso(0, 12), updatedAt: iso(0, 12) }),
  doc('seed_review_approved', { id: 'seed_review_approved', orderId: 'seed_order_receipt', productId: 'seed_prod_supply', productName: '冷链转运保温箱', productImage: products[4].images[0], userId: 'seed_customer_personal', userNickname: '陈小姐', rating: 4, content: '箱体结实，适合短途转运。', images: [], status: 'approved', adminReply: '感谢反馈，我们会继续优化包装细节。', createdAt: iso(-1, 19), updatedAt: iso(0, 9) }),
]

const logs = [
  doc('seed_log_login', { id: 'seed_log_login', operatorId: ADMIN_ID, operatorName: ADMIN_NAME, operatorRole: 'system_admin', action: 'login', target: ADMIN_ID, detail: '测试管理员登录后台。', result: 'success', ip: '127.0.0.1', createdAt: iso(0, 8) }),
  doc('seed_log_order', { id: 'seed_log_order', operatorId: 'seed_admin_service', operatorName: '客服值班', operatorRole: 'service', action: 'adjust_order_price', target: 'seed_order_pay_pending', detail: '演示订单改价前置数据。', result: 'success', ip: '127.0.0.1', createdAt: iso(0, 8, 35) }),
  doc('seed_log_failure', { id: 'seed_log_failure', operatorId: ADMIN_ID, operatorName: ADMIN_NAME, operatorRole: 'system_admin', action: 'invalid_transition', target: 'seed_return_refunding', detail: '演示失败日志筛选。', result: 'failure', ip: '127.0.0.1', createdAt: iso(-1, 18) }),
]

const notifications = [
  doc('seed_notice_return', { id: 'seed_notice_return', userId: 'seed_customer_hospital_a', title: '售后审核提醒', content: '您的售后申请已进入后台审核。', type: 'return', read: false, createdAt: iso(0, 10, 31), updatedAt: iso(0, 10, 31) }),
]

const analyticsDaily = Array.from({ length: 14 }, (_, index) => {
  const dayOffset = -index
  const date = dt(dayOffset, 0).slice(0, 10)
  const revenue = 2800 + index * 137
  return doc(`seed_analytics_${date}`, {
    id: `seed_analytics_${date}`,
    date,
    metrics: {
      pageViews: 420 - index * 8,
      productViews: 180 - index * 3,
      addToCarts: 72 - index,
      orderSubmits: 36 - Math.floor(index / 2),
      orderPayments: 24 - Math.floor(index / 3),
      newCustomers: 4 + (index % 3),
      activeCustomers: 62 - index,
      repeatPurchaseRate: 0.28 + (index % 4) * 0.015,
      averageOrderValue: Math.round(revenue / 24),
    },
    revenue: {
      total: revenue,
      institution: Math.round(revenue * 0.72),
      personal: Math.round(revenue * 0.28),
    },
    orders: {
      total: 30 - Math.floor(index / 2),
      paid: 24 - Math.floor(index / 3),
      refunded: index % 4 === 0 ? 1 : 0,
    },
    topProducts: [
      { productId: 'seed_prod_blood_a', productName: '犬用悬浮红细胞 1U', views: 70 - index, addToCarts: 22 - Math.floor(index / 2), orders: 10 - Math.floor(index / 3), revenue: 1380 + index * 20 },
      { productId: 'seed_prod_test_cbc', productName: '犬猫术前生化检测套餐', views: 54 - index, addToCarts: 18 - Math.floor(index / 2), orders: 8 - Math.floor(index / 3), revenue: 594 + index * 10 },
    ],
    agentContribution: [
      { salespersonId: 'seed_salesperson_chen', salespersonName: '陈启航', orderCount: 12 - Math.floor(index / 3), revenue: 2100 + index * 45, commission: 210 + index * 4 },
      { salespersonId: 'seed_salesperson_wu', salespersonName: '吴敏', orderCount: 5 - Math.floor(index / 5), revenue: 680 + index * 25, commission: 68 + index * 2 },
    ],
    createdAt: iso(dayOffset, 23),
    updatedAt: iso(dayOffset, 23, 5),
  })
})

const config = [
  doc('system', {
    commissionRate: 0.1,
    commissionLockDays: 7,
    minWithdrawAmount: 100,
    withdrawReviewEnabled: true,
    paymentTimeoutMinutes: 30,
    returnDeadlineDays: 7,
    returnAddress: '广东省广州市天河区华穗路88号大熊动医华南医学检验实验室',
    reviewTimeoutHours: 24,
    stockWarningThreshold: 10,
    pointsRate: 1,
    pointsExpiryDays: 365,
    rechargeTiers: [
      { amount: 500, bonus: 30, label: '测试充值500送30' },
      { amount: 1000, bonus: 100, label: '测试充值1000送100' },
    ],
    referralRewardPoints: 80,
    createdAt: iso(-20, 9),
    updatedAt: iso(0, 9),
  }),
]

const collections = {
  categories,
  products,
  users,
  orders,
  returns,
  withdrawals,
  invoices,
  commission_records: commissionRecords,
  coupon_templates: couponTemplates,
  user_coupons: userCoupons,
  card_vouchers: cardVouchers,
  test_reports: testReports,
  product_reviews: productReviews,
  logs,
  notifications,
  analytics_daily: analyticsDaily,
}

function insertCommandsFor(collection, docs) {
  const chunks = []
  for (let index = 0; index < docs.length; index += 3) {
    chunks.push(docs.slice(index, index + 3))
  }
  return chunks.map(chunk => ({
    TableName: collection,
    CommandType: 'INSERT',
    Command: JSON.stringify({
      insert: collection,
      documents: chunk,
    }),
  }))
}

function deleteCommandsFor(collection) {
  if (collection === 'config') return []
  return [{
    TableName: collection,
    CommandType: 'DELETE',
    Command: JSON.stringify({
      delete: collection,
      deletes: [{ q: { seedBatch: SEED_BATCH }, limit: 0 }],
    }),
  }]
}

function countCommandsFor(collection) {
  return [{
    TableName: collection,
    CommandType: 'COMMAND',
    Command: JSON.stringify({
      count: collection,
      query: { seedBatch: SEED_BATCH },
    }),
  }]
}

function seed() {
  const entries = Object.entries(collections)
  console.log(`Seeding ${SEED_BATCH} into ${ENV_ID}...`)
  for (const [collection, docs] of entries) {
    for (const command of deleteCommandsFor(collection)) {
      executeCommands([command], { print: false })
    }
    for (const command of insertCommandsFor(collection, docs)) {
      executeCommands([command], { print: false })
    }
    console.log(`  ${collection}: inserted ${docs.length}`)
  }
  console.log(`Done. Login account: dxdy_admin / any password with at least 6 characters.`)
}

function cleanup() {
  console.log(`Cleaning ${SEED_BATCH} from ${ENV_ID}...`)
  for (const collection of Object.keys(collections)) {
    const commands = deleteCommandsFor(collection)
    if (commands.length === 0) continue
    executeCommands(commands, { print: false })
    console.log(`  ${collection}: deleted seedBatch docs`)
  }
  console.log('Done. config/system is intentionally left untouched.')
}

function verifyCounts() {
  console.log(`Verifying seed counts for ${SEED_BATCH}...`)
  for (const [collection, docs] of Object.entries(collections)) {
    const output = executeCommands(countCommandsFor(collection), { print: false })
    const parsed = parseJsonFromOutput(output)
    const countDoc = parsed?.data?.results?.[0]?.[0]
    const count = Number(
      countDoc?.n?.$numberInt ??
      countDoc?.n?.$numberLong ??
      countDoc?.n ??
      Number.NaN,
    )
    if (count !== null && count < docs.length) {
      throw new Error(`${collection} count ${count} is lower than expected ${docs.length}`)
    }
    console.log(`  ${collection}: ${Number.isFinite(count) ? count : 'count checked'}`)
  }
}

function verifyCloudFunctions() {
  console.log('Verifying cloud function business flows...')
  fnInvoke('adminLogin', { username: 'dxdy_admin', password: 'seed123456', allowAnyPassword: true })
  console.log('  adminLogin: ok')
  fnInvoke('assignOrderToClerk', { orderId: 'seed_order_assign_ready', clerkId: 'seed_clerk_zhao', operatorId: ADMIN_ID, operatorName: ADMIN_NAME })
  console.log('  assignOrderToClerk: ok')
  fnInvoke('clerkShipOrder', {
    orderId: 'seed_order_ship_ready',
    company: '顺丰冷运',
    trackingNo: 'SFSEED202605210003',
    packageType: '冷藏箱',
    coldChainMethod: '冰袋2-6C',
    packageWeight: '2.6kg',
    boxTemperature: '4.0',
    operatorId: ADMIN_ID,
    operatorName: ADMIN_NAME,
  })
  console.log('  clerkShipOrder: ok')
  fnInvoke('reviewReturn', { id: 'seed_return_pending', approved: true, note: '测试审核通过', operatorId: ADMIN_ID, operatorName: ADMIN_NAME })
  console.log('  reviewReturn approve: ok')
  fnInvoke('reviewWithdrawal', { id: 'seed_withdraw_pending', approved: true, note: '测试审核通过', operatorId: ADMIN_ID, operatorName: ADMIN_NAME })
  console.log('  reviewWithdrawal approve: ok')
  fnInvoke('processInvoice', {
    id: 'seed_invoice_pending',
    status: 'issued',
    invoiceNo: 'INV-SEED-20260521',
    invoiceFileID: 'cloud://cloud1-d7g7ctn4m86bada89.seed/invoices/seed_invoice_pending.pdf',
    note: '测试开票',
    operatorId: ADMIN_ID,
    operatorName: ADMIN_NAME,
  })
  console.log('  processInvoice issue: ok')
}

if (mode === 'cleanup') cleanup()
else if (mode === 'verify') {
  verifyCounts()
  if (!args.has('--counts-only')) verifyCloudFunctions()
} else {
  seed()
}
