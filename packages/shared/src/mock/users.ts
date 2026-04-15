import type { Customer, Salesperson, Clerk, AdminUser } from '../types/user';

// ========================
// 客户（机构 + 个人，共 6 个）
// ========================

export const mockCustomers: Customer[] = [
  // --- 机构客户 A：已实名认证通过，有绑定业务员，有钱包余额和积分 ---
  {
    id: 'cust_001',
    phone: '13821003456',
    nickname: '鼎盛酒业旗舰店',
    avatar: '',
    role: 'customer',
    customerType: 'institution',
    verificationStatus: 'approved',
    verificationInfo: {
      businessLicense: '91310115MA1K4XYZ3R',
      contactName: '陈建国',
      contactPhone: '13821003456',
    },
    boundSalespersonId: 'sp_001',
    wallet: {
      balance: 52800.0,
      rechargeHistory: [
        {
          id: 'rch_001',
          amount: 30000,
          bonus: 1500,
          createdAt: '2026-04-11',
        },
        {
          id: 'rch_002',
          amount: 20000,
          bonus: 800,
          createdAt: '2026-04-13',
        },
      ],
    },
    points: {
      balance: 12500,
      history: [
        {
          id: 'pts_001',
          change: 8000,
          balance: 8000,
          reason: '下单奖励',
          createdAt: '2026-04-12',
        },
        {
          id: 'pts_002',
          change: 4500,
          balance: 12500,
          reason: '签到积分',
          createdAt: '2026-04-14',
        },
      ],
    },
    addresses: [
      {
        id: 'addr_001',
        name: '陈建国',
        phone: '13821003456',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        detail: '张杨路500号华润时代广场12层',
        isDefault: true,
      },
      {
        id: 'addr_002',
        name: '李秀芬',
        phone: '13821007890',
        province: '上海市',
        city: '上海市',
        district: '徐汇区',
        detail: '漕溪北路398号',
        isDefault: false,
      },
    ],
    createdAt: '2026-04-10',
  },

  // --- 机构客户 B：实名认证待审核 ---
  {
    id: 'cust_002',
    phone: '13833001122',
    nickname: '恒通商贸',
    avatar: '',
    role: 'customer',
    customerType: 'institution',
    verificationStatus: 'pending',
    verificationInfo: {
      businessLicense: '91440300MA5FGB123H',
      contactName: '王志远',
      contactPhone: '13833001122',
    },
    boundSalespersonId: null,
    wallet: {
      balance: 0,
      rechargeHistory: [],
    },
    points: {
      balance: 200,
      history: [
        {
          id: 'pts_003',
          change: 200,
          balance: 200,
          reason: '注册赠送',
          createdAt: '2026-04-14',
        },
      ],
    },
    addresses: [
      {
        id: 'addr_003',
        name: '王志远',
        phone: '13833001122',
        province: '广东省',
        city: '深圳市',
        district: '南山区',
        detail: '科技园路1号科兴科学园B3栋6层',
        isDefault: true,
      },
    ],
    createdAt: '2026-04-14',
  },

  // --- 机构客户 C：实名认证被拒绝（可重新提交） ---
  {
    id: 'cust_003',
    phone: '13855004488',
    nickname: '鑫源贸易',
    avatar: '',
    role: 'customer',
    customerType: 'institution',
    verificationStatus: 'rejected',
    verificationInfo: {
      businessLicense: '91330206MA2AGHXXX',
      contactName: '刘海涛',
      contactPhone: '13855004488',
      rejectReason: '营业执照照片模糊，请重新上传清晰的营业执照原件照片',
    },
    boundSalespersonId: null,
    wallet: {
      balance: 0,
      rechargeHistory: [],
    },
    points: {
      balance: 200,
      history: [
        {
          id: 'pts_004',
          change: 200,
          balance: 200,
          reason: '注册赠送',
          createdAt: '2026-04-13',
        },
      ],
    },
    addresses: [
      {
        id: 'addr_004',
        name: '刘海涛',
        phone: '13855004488',
        province: '浙江省',
        city: '宁波市',
        district: '鄞州区',
        detail: '百丈东路38号',
        isDefault: true,
      },
    ],
    createdAt: '2026-04-13',
  },

  // --- 个人消费者 A：正常使用状态，有积分有钱包 ---
  {
    id: 'cust_004',
    phone: '13877005678',
    nickname: '张小明',
    avatar: '',
    role: 'customer',
    customerType: 'personal',
    verificationStatus: 'approved',
    boundSalespersonId: null,
    wallet: {
      balance: 3200.0,
      rechargeHistory: [
        {
          id: 'rch_003',
          amount: 5000,
          bonus: 200,
          createdAt: '2026-04-11',
        },
      ],
    },
    points: {
      balance: 4800,
      history: [
        {
          id: 'pts_005',
          change: 200,
          balance: 200,
          reason: '注册赠送',
          createdAt: '2026-04-10',
        },
        {
          id: 'pts_006',
          change: 3600,
          balance: 3800,
          reason: '下单奖励',
          createdAt: '2026-04-12',
        },
        {
          id: 'pts_007',
          change: 1000,
          balance: 4800,
          reason: '评价奖励',
          createdAt: '2026-04-14',
        },
      ],
    },
    addresses: [
      {
        id: 'addr_005',
        name: '张小明',
        phone: '13877005678',
        province: '江苏省',
        city: '南京市',
        district: '鼓楼区',
        detail: '中山北路30号城市名人酒店旁',
        isDefault: true,
      },
    ],
    createdAt: '2026-04-10',
  },

  // --- 个人消费者 B：新注册用户 ---
  {
    id: 'cust_005',
    phone: '13888002233',
    nickname: '微信用户8223',
    avatar: '',
    role: 'customer',
    customerType: 'personal',
    verificationStatus: 'none',
    boundSalespersonId: null,
    wallet: {
      balance: 0,
      rechargeHistory: [],
    },
    points: {
      balance: 0,
      history: [],
    },
    addresses: [],
    createdAt: '2026-04-15',
  },

  // --- 个人消费者 C：有退换货记录 ---
  {
    id: 'cust_006',
    phone: '13899006677',
    nickname: '赵婷',
    avatar: '',
    role: 'customer',
    customerType: 'personal',
    verificationStatus: 'approved',
    boundSalespersonId: null,
    wallet: {
      balance: 1500.0,
      rechargeHistory: [
        {
          id: 'rch_004',
          amount: 3000,
          bonus: 100,
          createdAt: '2026-04-10',
        },
      ],
    },
    points: {
      balance: 2200,
      history: [
        {
          id: 'pts_008',
          change: 200,
          balance: 200,
          reason: '注册赠送',
          createdAt: '2026-04-10',
        },
        {
          id: 'pts_009',
          change: 2500,
          balance: 2700,
          reason: '下单奖励',
          createdAt: '2026-04-11',
        },
        {
          id: 'pts_010',
          change: -500,
          balance: 2200,
          reason: '退货扣减积分',
          createdAt: '2026-04-13',
        },
      ],
    },
    addresses: [
      {
        id: 'addr_006',
        name: '赵婷',
        phone: '13899006677',
        province: '四川省',
        city: '成都市',
        district: '武侯区',
        detail: '天府大道北段1700号环球中心S1区',
        isDefault: true,
      },
    ],
    createdAt: '2026-04-10',
  },
];

// ========================
// 业务员（2 个）
// ========================

export const mockSalespersons: Salesperson[] = [
  // --- 业务员 A：已认证，有客户，有提成数据 ---
  {
    id: 'sp_001',
    phone: '13811001234',
    nickname: '李明辉',
    avatar: '',
    role: 'salesperson',
    verificationStatus: 'approved',
    verificationInfo: {
      realName: '李明辉',
      idCard: '310115199208XXXXXXX',
    },
    commission: {
      total: 28600.0,
      available: 15200.0,
      withdrawn: 12000.0,
      pendingDeduction: 1400.0,
    },
    bankCards: [
      {
        id: 'bank_001',
        bankName: '招商银行',
        cardNo: '6225****8901',
        holderName: '李明辉',
      },
    ],
    customers: ['cust_001'],
    createdAt: '2026-04-10',
  },

  // --- 业务员 B：认证待审核 ---
  {
    id: 'sp_002',
    phone: '13822005678',
    nickname: '周晓峰',
    avatar: '',
    role: 'salesperson',
    verificationStatus: 'pending',
    verificationInfo: {
      realName: '周晓峰',
      idCard: '320106199505XXXXXXX',
    },
    commission: {
      total: 0,
      available: 0,
      withdrawn: 0,
      pendingDeduction: 0,
    },
    bankCards: [],
    customers: [],
    createdAt: '2026-04-14',
  },
];

// ========================
// 制单员（2 个）
// ========================

export const mockClerks: Clerk[] = [
  // --- 制单员 A：有分配的订单 ---
  {
    id: 'clerk_001',
    phone: '13833007890',
    nickname: '孙文静',
    avatar: '',
    role: 'clerk',
    realName: '孙文静',
    assignedOrderIds: ['ord_001', 'ord_002', 'ord_003'],
    createdAt: '2026-04-10',
  },

  // --- 制单员 B：空闲 ---
  {
    id: 'clerk_002',
    phone: '13844001122',
    nickname: '马逸飞',
    avatar: '',
    role: 'clerk',
    realName: '马逸飞',
    assignedOrderIds: [],
    createdAt: '2026-04-12',
  },
];

// ========================
// 后台管理员（3 个）
// ========================

export const mockAdminUsers: AdminUser[] = [
  // --- 客服：有改价权限 ---
  {
    id: 'admin_001',
    username: 'service',
    password: 'hashed_password_service',
    realName: '吴晓燕',
    phone: '13855001100',
    role: 'service',
    permissions: {
      order_view: true,
      order_price_adjust: true,
      order_cancel: true,
      customer_view: true,
      refund_approve: true,
    },
    status: 'active',
  },

  // --- 商品管理员 ---
  {
    id: 'admin_002',
    username: 'product_manager',
    password: 'hashed_password_product',
    realName: '陈伟',
    phone: '13866002200',
    role: 'product_manager',
    permissions: {
      product_view: true,
      product_create: true,
      product_edit: true,
      product_delete: true,
      category_manage: true,
      inventory_view: true,
      inventory_adjust: true,
    },
    status: 'active',
  },

  // --- 系统管理员：全部权限 ---
  {
    id: 'admin_003',
    username: 'system_admin',
    password: 'hashed_password_system',
    realName: '黄建华',
    phone: '13877003300',
    role: 'system_admin',
    permissions: {
      order_view: true,
      order_price_adjust: true,
      order_cancel: true,
      customer_view: true,
      refund_approve: true,
      product_view: true,
      product_create: true,
      product_edit: true,
      product_delete: true,
      category_manage: true,
      inventory_view: true,
      inventory_adjust: true,
      user_manage: true,
      salesperson_manage: true,
      clerk_manage: true,
      system_config: true,
      data_export: true,
      log_view: true,
    },
    status: 'active',
  },
];
