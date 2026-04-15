import type { Order } from '../types/order';
import type { ReturnRecord } from '../types/system';

// ========== 订单 ==========

export const mockOrders: Order[] = [
  // ── 普通订单 ──

  // cust_001(机构) 已完成，有提成
  {
    id: 'ord_001',
    type: 'normal',
    status: 'completed',
    customerId: 'cust_001',
    customerName: '鼎盛酒业旗舰店',
    salespersonId: 'sp_001',
    clerkId: 'clerk_001',
    items: [
      {
        productId: 'prod_001',
        productName: 'ABO 血型鉴定试剂盒',
        productImage: '',
        spec: '50人份/盒',
        quantity: 10,
        unitPrice: 120,
        totalPrice: 1200,
      },
      {
        productId: 'prod_005',
        productName: '一次性真空采血管（EDTA）',
        productImage: '',
        spec: '100支/盒',
        quantity: 20,
        unitPrice: 45,
        totalPrice: 900,
      },
    ],
    pricing: {
      originalAmount: 2100,
      actualAmount: 2100,
      priceLog: [],
    },
    shipping: {
      address: { name: '陈建国', phone: '13821003456', full: '上海市浦东新区张杨路500号华润时代广场12层' },
      trackingNo: 'SF1234567890',
      company: '顺丰速运',
      logistics: [
        { time: '2026-04-11 14:00', description: '已签收', location: '上海' },
        { time: '2026-04-11 08:00', description: '派送中', location: '上海浦东新区' },
        { time: '2026-04-10 18:00', description: '已发货', location: '广州仓库' },
      ],
    },
    returnRecordId: null,
    commission: { status: 'settled', amount: 420, settledAt: '2026-04-13' },
    createdAt: '2026-04-10 10:30',
    updatedAt: '2026-04-11 14:00',
  },

  // cust_001(机构) 已发货
  {
    id: 'ord_002',
    type: 'normal',
    status: 'pending_receipt',
    customerId: 'cust_001',
    customerName: '鼎盛酒业旗舰店',
    salespersonId: 'sp_001',
    clerkId: 'clerk_001',
    items: [
      {
        productId: 'prod_009',
        productName: '悬浮红细胞（1U）',
        productImage: '',
        spec: '1U/袋（约200mL）',
        quantity: 5,
        unitPrice: 580,
        totalPrice: 2900,
      },
    ],
    pricing: { originalAmount: 2900, actualAmount: 2900, priceLog: [] },
    shipping: {
      address: { name: '陈建国', phone: '13821003456', full: '上海市浦东新区张杨路500号华润时代广场12层' },
      trackingNo: 'JD9876543210',
      company: '京东物流',
      logistics: [
        { time: '2026-04-14 20:00', description: '运输中', location: '上海中转站' },
        { time: '2026-04-14 10:00', description: '已发货', location: '广州血站' },
      ],
    },
    returnRecordId: null,
    commission: { status: 'locked', amount: 580, settledAt: null },
    createdAt: '2026-04-14 09:15',
    updatedAt: '2026-04-14 10:00',
  },

  // cust_001(机构) 待发货，有改价
  {
    id: 'ord_003',
    type: 'normal',
    status: 'pending_shipment',
    customerId: 'cust_001',
    customerName: '鼎盛酒业旗舰店',
    salespersonId: 'sp_001',
    clerkId: 'clerk_001',
    items: [
      {
        productId: 'prod_003',
        productName: '交叉配血试剂盒',
        productImage: '',
        spec: '20人份/盒',
        quantity: 8,
        unitPrice: 250,
        totalPrice: 2000,
      },
    ],
    pricing: {
      originalAmount: 2000,
      actualAmount: 1800,
      priceLog: [
        {
          originalPrice: 2000,
          modifiedPrice: 1800,
          operatorId: 'admin_001',
          operatorName: '吴晓燕',
          operatedAt: '2026-04-15 09:00',
        },
      ],
    },
    shipping: {
      address: { name: '李秀芬', phone: '13821007890', full: '上海市徐汇区漕溪北路398号' },
      trackingNo: null,
      company: null,
      logistics: [],
    },
    returnRecordId: null,
    commission: { status: 'pending', amount: 360, settledAt: null },
    createdAt: '2026-04-14 16:45',
    updatedAt: '2026-04-15 09:00',
  },

  // cust_004(个人) 已完成
  {
    id: 'ord_004',
    type: 'normal',
    status: 'completed',
    customerId: 'cust_004',
    customerName: '张小明',
    salespersonId: 'sp_001',
    clerkId: null,
    items: [
      {
        productId: 'prod_016',
        productName: '血型检测服务',
        productImage: '',
        spec: '到店检测',
        quantity: 1,
        unitPrice: 200,
        totalPrice: 200,
      },
    ],
    pricing: { originalAmount: 200, actualAmount: 200, priceLog: [] },
    shipping: {
      address: { name: '张小明', phone: '13877005678', full: '江苏省南京市鼓楼区中山北路30号城市名人酒店旁' },
      trackingNo: null,
      company: null,
      logistics: [],
    },
    returnRecordId: null,
    commission: { status: 'settled', amount: 40, settledAt: '2026-04-13' },
    createdAt: '2026-04-11 11:00',
    updatedAt: '2026-04-12 16:00',
  },

  // cust_006(个人) 有退货
  {
    id: 'ord_005',
    type: 'normal',
    status: 'completed',
    customerId: 'cust_006',
    customerName: '赵婷',
    salespersonId: 'sp_001',
    clerkId: null,
    items: [
      {
        productId: 'prod_017',
        productName: '献血后健康评估报告',
        productImage: '',
        spec: '电子版 + 纸质版',
        quantity: 1,
        unitPrice: 350,
        totalPrice: 350,
      },
      {
        productId: 'prod_019',
        productName: '献血预约提醒服务',
        productImage: '',
        spec: '1年',
        quantity: 1,
        unitPrice: 120,
        totalPrice: 120,
      },
    ],
    pricing: { originalAmount: 470, actualAmount: 470, priceLog: [] },
    shipping: {
      address: { name: '赵婷', phone: '13899006677', full: '四川省成都市武侯区天府大道北段1700号环球中心S1区' },
      trackingNo: 'YT6667778889',
      company: '圆通速递',
      logistics: [
        { time: '2026-04-12 15:00', description: '已签收', location: '成都' },
      ],
    },
    returnRecordId: 'ret_001',
    commission: { status: 'adjusted', amount: 94, settledAt: '2026-04-12' },
    createdAt: '2026-04-10 14:20',
    updatedAt: '2026-04-14 10:00',
  },

  // cust_002(机构) 待支付
  {
    id: 'ord_006',
    type: 'normal',
    status: 'pending_payment',
    customerId: 'cust_002',
    customerName: '恒通商贸',
    salespersonId: '',
    clerkId: null,
    items: [
      {
        productId: 'prod_002',
        productName: 'Rh(D) 血型鉴定试剂盒',
        productImage: '',
        spec: '100人份/盒',
        quantity: 5,
        unitPrice: 180,
        totalPrice: 900,
      },
    ],
    pricing: { originalAmount: 900, actualAmount: 900, priceLog: [] },
    shipping: {
      address: { name: '王志远', phone: '13833001122', full: '广东省深圳市南山区科技园路1号科兴科学园B3栋6层' },
      trackingNo: null,
      company: null,
      logistics: [],
    },
    returnRecordId: null,
    commission: { status: 'pending', amount: 180, settledAt: null },
    createdAt: '2026-04-15 11:30',
    updatedAt: '2026-04-15 11:30',
  },

  // ── 预约订单 ──

  // cust_001(机构) 预约进行中
  {
    id: 'ord_007',
    type: 'booking',
    status: 'confirmed',
    customerId: 'cust_001',
    customerName: '鼎盛酒业旗舰店',
    salespersonId: 'sp_001',
    clerkId: 'clerk_001',
    items: [
      {
        productId: 'prod_011',
        productName: '单采血小板（1治疗量）',
        productImage: '',
        spec: '1治疗量/袋',
        quantity: 3,
        unitPrice: 1500,
        totalPrice: 4500,
      },
    ],
    pricing: { originalAmount: 4500, actualAmount: 4500, priceLog: [] },
    shipping: {
      address: { name: '陈建国', phone: '13821003456', full: '上海市浦东新区张杨路500号华润时代广场12层' },
      trackingNo: null,
      company: null,
      logistics: [],
    },
    booking: { date: '2026-04-18', location: '上海市血液中心', contactName: '陈建国', contactPhone: '13821003456' },
    returnRecordId: null,
    commission: { status: 'pending', amount: 900, settledAt: null },
    createdAt: '2026-04-14 10:00',
    updatedAt: '2026-04-15 09:30',
  },

  // cust_004(个人) 预约待确认
  {
    id: 'ord_008',
    type: 'booking',
    status: 'pending_confirmation',
    customerId: 'cust_004',
    customerName: '张小明',
    salespersonId: '',
    clerkId: null,
    items: [
      {
        productId: 'prod_018',
        productName: '亲子鉴定咨询服务',
        productImage: '',
        spec: '线上咨询 + 线下采样',
        quantity: 1,
        unitPrice: 800,
        totalPrice: 800,
      },
    ],
    pricing: { originalAmount: 800, actualAmount: 800, priceLog: [] },
    shipping: {
      address: { name: '张小明', phone: '13877005678', full: '江苏省南京市鼓楼区中山北路30号城市名人酒店旁' },
      trackingNo: null,
      company: null,
      logistics: [],
    },
    booking: { date: '2026-04-20', location: '南京中心血站', contactName: '张小明', contactPhone: '13877005678' },
    returnRecordId: null,
    commission: { status: 'pending', amount: 160, settledAt: null },
    createdAt: '2026-04-15 08:00',
    updatedAt: '2026-04-15 08:00',
  },

  // cust_001(机构) 预约已完成
  {
    id: 'ord_009',
    type: 'booking',
    status: 'completed',
    customerId: 'cust_001',
    customerName: '鼎盛酒业旗舰店',
    salespersonId: 'sp_001',
    clerkId: 'clerk_001',
    items: [
      {
        productId: 'prod_010',
        productName: '新鲜冰冻血浆（200mL）',
        productImage: '',
        spec: '200mL/袋',
        quantity: 10,
        unitPrice: 720,
        totalPrice: 7200,
      },
    ],
    pricing: { originalAmount: 7200, actualAmount: 7200, priceLog: [] },
    shipping: {
      address: { name: '陈建国', phone: '13821003456', full: '上海市浦东新区张杨路500号华润时代广场12层' },
      trackingNo: null,
      company: null,
      logistics: [],
    },
    booking: { date: '2026-04-12', location: '上海市血液中心', contactName: '陈建国', contactPhone: '13821003456' },
    returnRecordId: null,
    commission: { status: 'settled', amount: 1440, settledAt: '2026-04-14' },
    createdAt: '2026-04-10 16:00',
    updatedAt: '2026-04-12 17:00',
  },

  // cust_005(个人) 已取消
  {
    id: 'ord_010',
    type: 'normal',
    status: 'cancelled',
    customerId: 'cust_005',
    customerName: '微信用户8223',
    salespersonId: '',
    clerkId: null,
    items: [
      {
        productId: 'prod_007',
        productName: '血型鉴定卡',
        productImage: '',
        spec: '12孔/卡',
        quantity: 2,
        unitPrice: 100,
        totalPrice: 200,
      },
    ],
    pricing: { originalAmount: 200, actualAmount: 200, priceLog: [] },
    shipping: {
      address: { name: '微信用户8223', phone: '13888002233', full: '' },
      trackingNo: null,
      company: null,
      logistics: [],
    },
    returnRecordId: null,
    commission: { status: 'pending', amount: 0, settledAt: null },
    remark: '超时未支付，系统自动取消',
    createdAt: '2026-04-15 10:00',
    updatedAt: '2026-04-15 10:30',
  },
];

// ========== 退换货 ==========

export const mockReturns: ReturnRecord[] = [
  // ord_005 部分退货，已完成
  {
    id: 'ret_001',
    orderId: 'ord_005',
    type: 'return',
    status: 'return_completed',
    reason: '报告信息有误',
    items: [
      { productId: 'prod_017', productName: '献血后健康评估报告', quantity: 1, unitPrice: 350 },
    ],
    refundAmount: 350,
    sendLogistics: { trackingNo: 'YT1112223334', company: '圆通速递' },
    receiveLogistics: null,
    verificationResult: 'qualified',
    commissionAdjust: { amount: -70, reason: '退货扣除提成' },
    reviewerId: 'admin_001',
    reviewNote: '核实后确认信息有误，同意退货',
    createdAt: '2026-04-13 09:00',
    updatedAt: '2026-04-14 10:00',
  },

  // 换货进行中
  {
    id: 'ret_002',
    orderId: 'ord_001',
    type: 'exchange',
    status: 'exchange_shipping',
    reason: '试剂盒规格选错',
    items: [
      { productId: 'prod_001', productName: 'ABO 血型鉴定试剂盒', quantity: 2, unitPrice: 120 },
    ],
    exchangeItem: { productId: 'prod_002', productName: 'Rh(D) 血型鉴定试剂盒', spec: '100人份/盒', quantity: 2, unitPrice: 180 },
    sendLogistics: { trackingNo: 'SF5556667778', company: '顺丰速运' },
    receiveLogistics: { trackingNo: 'SF5556667778', company: '顺丰速运' },
    verificationResult: 'qualified',
    commissionAdjust: { amount: -120, reason: '换货差价调整提成' },
    reviewerId: 'admin_001',
    reviewNote: '同意换货',
    createdAt: '2026-04-13 15:00',
    updatedAt: '2026-04-15 08:00',
  },

  // 待审核
  {
    id: 'ret_003',
    orderId: 'ord_002',
    type: 'return',
    status: 'pending_review',
    reason: '血制品温度异常',
    items: [
      { productId: 'prod_009', productName: '悬浮红细胞（1U）', quantity: 1, unitPrice: 580 },
    ],
    refundAmount: 580,
    sendLogistics: null,
    receiveLogistics: null,
    verificationResult: 'pending',
    commissionAdjust: { amount: 0, reason: '' },
    reviewerId: null,
    reviewNote: '',
    createdAt: '2026-04-15 10:00',
    updatedAt: '2026-04-15 10:00',
  },
];
