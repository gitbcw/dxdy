import type { Product, ProductCategory } from '../types/product';

// ========== 商品分类 ==========

export const mockCategories: ProductCategory[] = [
  { id: 'cat_kit', name: '试剂盒', icon: '🧪', sort: 1 },
  { id: 'cat_consumable', name: '耗材', icon: '🧴', sort: 2 },
  { id: 'cat_blood', name: '血制品', icon: '🩸', sort: 3 },
  { id: 'cat_equipment', name: '设备', icon: '🔬', sort: 4 },
  { id: 'cat_service', name: '服务', icon: '📋', sort: 5 },
];

// ========== 商品 ==========

export const mockProducts: Product[] = [
  // ── 试剂盒 (cat_kit) ──────────────────────────────────────────

  // prod_001: visibility=all, 支持退换, 库存充足
  {
    id: 'prod_001',
    name: 'ABO 血型鉴定试剂盒',
    description: '用于 ABO 血型正定型的快速检测，操作简便，结果准确。',
    images: [],
    category: 'cat_kit',
    specs: [
      { name: '规格', value: '50人份/盒' },
      { name: '有效期', value: '12个月' },
      { name: '储存条件', value: '2-8°C' },
    ],
    institutionPrice: 120,
    personalPrice: 180,
    pointsPrice: 150,
    visibility: 'all',
    stock: 200,
    status: 'on_sale',
    returnPolicy: { enabled: true, deadlineDays: 7, note: '未拆封可退' },
    isBloodPack: false,
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-03-15T10:30:00Z',
  },

  // prod_002: visibility=all, 支持退换, 库存充足
  {
    id: 'prod_002',
    name: 'Rh(D) 血型鉴定试剂盒',
    description: 'Rh(D) 血型定性检测，灵敏度高，适用于临床常规检测。',
    images: [],
    category: 'cat_kit',
    specs: [
      { name: '规格', value: '100人份/盒' },
      { name: '有效期', value: '18个月' },
      { name: '储存条件', value: '2-8°C' },
    ],
    institutionPrice: 180,
    personalPrice: 240,
    pointsPrice: 200,
    visibility: 'all',
    stock: 150,
    status: 'on_sale',
    returnPolicy: { enabled: true, deadlineDays: 7, note: '未拆封可退' },
    isBloodPack: false,
    createdAt: '2026-03-02T09:00:00Z',
    updatedAt: '2026-03-16T14:20:00Z',
  },

  // prod_003: visibility=all, 不支持退换, 库存低
  {
    id: 'prod_003',
    name: '交叉配血试剂盒',
    description: '用于患者与献血者之间的交叉配血试验，确保输血安全。',
    images: [],
    category: 'cat_kit',
    specs: [
      { name: '规格', value: '20人份/盒' },
      { name: '有效期', value: '12个月' },
      { name: '储存条件', value: '2-8°C' },
    ],
    institutionPrice: 250,
    personalPrice: 320,
    visibility: 'all',
    stock: 8,
    status: 'on_sale',
    returnPolicy: { enabled: false, deadlineDays: 0, note: '生物制品一经售出不支持退换' },
    isBloodPack: false,
    createdAt: '2026-03-05T10:00:00Z',
    updatedAt: '2026-03-20T09:15:00Z',
  },

  // prod_004: visibility=all, 支持退换, 库存充足
  {
    id: 'prod_004',
    name: '不规则抗体筛查试剂盒',
    description: '检测患者血清中不规则抗体，预防输血不良反应。',
    images: [],
    category: 'cat_kit',
    specs: [
      { name: '规格', value: '50人份/盒' },
      { name: '有效期', value: '12个月' },
      { name: '储存条件', value: '2-8°C' },
    ],
    institutionPrice: 320,
    personalPrice: 400,
    pointsPrice: 350,
    visibility: 'all',
    stock: 120,
    status: 'on_sale',
    returnPolicy: { enabled: true, deadlineDays: 7, note: '未拆封可退' },
    isBloodPack: false,
    createdAt: '2026-03-08T11:00:00Z',
    updatedAt: '2026-03-22T16:00:00Z',
  },

  // ── 耗材 (cat_consumable) ─────────────────────────────────────

  // prod_005: visibility=all, 支持退换, 库存充足
  {
    id: 'prod_005',
    name: '一次性真空采血管（EDTA）',
    description: '适用于血液标本采集，EDTA 抗凝，紫色管帽标识。',
    images: [],
    category: 'cat_consumable',
    specs: [
      { name: '规格', value: '2mL/支' },
      { name: '包装', value: '100支/盒' },
      { name: '材质', value: 'PET' },
    ],
    institutionPrice: 45,
    personalPrice: 60,
    pointsPrice: 50,
    visibility: 'all',
    stock: 500,
    status: 'on_sale',
    returnPolicy: { enabled: true, deadlineDays: 15, note: '未拆封、包装完好可退' },
    isBloodPack: false,
    createdAt: '2026-03-10T08:30:00Z',
    updatedAt: '2026-03-25T11:00:00Z',
  },

  // prod_006: visibility=all, 不支持退换, 库存充足
  {
    id: 'prod_006',
    name: '输血器（含滤网）',
    description: '一次性使用输血器，内置 170μm 滤网，有效过滤血液中的微聚物。',
    images: [],
    category: 'cat_consumable',
    specs: [
      { name: '规格', value: '标准型' },
      { name: '包装', value: '50支/盒' },
      { name: '滤网孔径', value: '170μm' },
    ],
    institutionPrice: 35,
    personalPrice: 48,
    visibility: 'all',
    stock: 300,
    status: 'on_sale',
    returnPolicy: { enabled: false, deadlineDays: 0, note: '一次性医疗耗材不支持退换' },
    isBloodPack: false,
    createdAt: '2026-03-12T09:00:00Z',
    updatedAt: '2026-03-28T10:00:00Z',
  },

  // prod_007: visibility=all, 支持退换, 库存低
  {
    id: 'prod_007',
    name: '血型鉴定卡',
    description: '用于 ABO/Rh 血型鉴定的微柱凝胶卡，操作简便、结果清晰。',
    images: [],
    category: 'cat_consumable',
    specs: [
      { name: '规格', value: '12孔/卡' },
      { name: '包装', value: '20卡/盒' },
      { name: '检测项目', value: 'ABO + Rh(D)' },
    ],
    institutionPrice: 80,
    personalPrice: 100,
    pointsPrice: 85,
    visibility: 'all',
    stock: 6,
    status: 'on_sale',
    returnPolicy: { enabled: true, deadlineDays: 7, note: '未拆封可退' },
    isBloodPack: false,
    createdAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-04-01T14:00:00Z',
  },

  // prod_008: visibility=all, 不支持退换, 库存充足
  {
    id: 'prod_008',
    name: '一次性使用无菌注射器',
    description: '用于药物注射及血液标本采集，带针头，无菌包装。',
    images: [],
    category: 'cat_consumable',
    specs: [
      { name: '规格', value: '5mL' },
      { name: '包装', value: '100支/盒' },
      { name: '针头规格', value: '21G' },
    ],
    institutionPrice: 25,
    personalPrice: 35,
    visibility: 'all',
    stock: 800,
    status: 'on_sale',
    returnPolicy: { enabled: false, deadlineDays: 0, note: '一次性医疗耗材不支持退换' },
    isBloodPack: false,
    createdAt: '2026-03-18T08:00:00Z',
    updatedAt: '2026-04-02T09:30:00Z',
  },

  // ── 血制品 (cat_blood) - 仅机构可见 ──────────────────────────

  // prod_009: visibility=institution_only, 不支持退换, 库存充足, 血包
  {
    id: 'prod_009',
    name: '悬浮红细胞（1U）',
    description: '去白细胞悬浮红细胞，适用于贫血及手术患者输注。',
    images: [],
    category: 'cat_blood',
    specs: [
      { name: '规格', value: '1U/袋（约200mL）' },
      { name: '血型', value: '需指定 ABO 及 Rh 血型' },
      { name: '储存条件', value: '2-6°C' },
    ],
    institutionPrice: 580,
    personalPrice: 0,
    visibility: 'institution_only',
    stock: 45,
    status: 'on_sale',
    returnPolicy: { enabled: false, deadlineDays: 0, note: '血制品一经出库不支持退换' },
    isBloodPack: true,
    createdAt: '2026-03-05T07:00:00Z',
    updatedAt: '2026-04-05T08:00:00Z',
  },

  // prod_010: visibility=institution_only, 不支持退换, 库存低, 血包
  {
    id: 'prod_010',
    name: '新鲜冰冻血浆（200mL）',
    description: '含有全部凝血因子，适用于凝血功能障碍患者。',
    images: [],
    category: 'cat_blood',
    specs: [
      { name: '规格', value: '200mL/袋' },
      { name: '血型', value: '需指定 ABO 血型' },
      { name: '储存条件', value: '-30°C以下' },
    ],
    institutionPrice: 720,
    personalPrice: 0,
    visibility: 'institution_only',
    stock: 3,
    status: 'on_sale',
    returnPolicy: { enabled: false, deadlineDays: 0, note: '血制品一经出库不支持退换' },
    isBloodPack: true,
    createdAt: '2026-03-08T08:00:00Z',
    updatedAt: '2026-04-06T10:00:00Z',
  },

  // prod_011: visibility=institution_only, 不支持退换, 库存充足
  {
    id: 'prod_011',
    name: '单采血小板（1治疗量）',
    description: '采用单采技术采集的浓缩血小板，止血效果显著。',
    images: [],
    category: 'cat_blood',
    specs: [
      { name: '规格', value: '1治疗量/袋（≥2.5×10^11个血小板）' },
      { name: '储存条件', value: '20-24°C 振荡保存' },
      { name: '有效期', value: '5天' },
    ],
    institutionPrice: 1500,
    personalPrice: 0,
    visibility: 'institution_only',
    stock: 20,
    status: 'on_sale',
    returnPolicy: { enabled: false, deadlineDays: 0, note: '血制品一经出库不支持退换' },
    isBloodPack: false,
    createdAt: '2026-03-12T07:30:00Z',
    updatedAt: '2026-04-07T11:00:00Z',
  },

  // prod_012: visibility=institution_only, 不支持退换, 库存低, 血包
  {
    id: 'prod_012',
    name: '冷沉淀凝血因子（1U）',
    description: '含丰富因子VIII、纤维蛋白原等，适用于甲型血友病及纤维蛋白原缺乏症。',
    images: [],
    category: 'cat_blood',
    specs: [
      { name: '规格', value: '1U/袋' },
      { name: '储存条件', value: '-30°C以下' },
      { name: '有效期', value: '12个月' },
    ],
    institutionPrice: 860,
    personalPrice: 0,
    visibility: 'institution_only',
    stock: 5,
    status: 'on_sale',
    returnPolicy: { enabled: false, deadlineDays: 0, note: '血制品一经出库不支持退换' },
    isBloodPack: true,
    createdAt: '2026-03-15T09:00:00Z',
    updatedAt: '2026-04-08T13:00:00Z',
  },

  // prod_013: visibility=institution_only, 不支持退换, 库存充足
  {
    id: 'prod_013',
    name: '全血（400mL）',
    description: '采集自健康献血者的全血，含红细胞、白细胞、血小板和血浆全部成分。',
    images: [],
    category: 'cat_blood',
    specs: [
      { name: '规格', value: '400mL/袋' },
      { name: '血型', value: '需指定 ABO 及 Rh 血型' },
      { name: '储存条件', value: '2-6°C' },
    ],
    institutionPrice: 980,
    personalPrice: 0,
    visibility: 'institution_only',
    stock: 30,
    status: 'on_sale',
    returnPolicy: { enabled: false, deadlineDays: 0, note: '血制品一经出库不支持退换' },
    isBloodPack: false,
    createdAt: '2026-03-20T08:00:00Z',
    updatedAt: '2026-04-09T09:00:00Z',
  },

  // ── 设备 (cat_equipment) - 仅机构可见 ──────────────────────────

  // prod_014: visibility=all, 支持退换, 库存充足
  {
    id: 'prod_014',
    name: '全自动血型分析仪',
    description: '全自动 ABO/Rh 血型检测设备，高通量、高精度，支持批量检测。',
    images: [],
    category: 'cat_equipment',
    specs: [
      { name: '检测速度', value: '120样本/小时' },
      { name: '检测方法', value: '微柱凝胶法' },
      { name: '尺寸', value: '600×500×450mm' },
    ],
    institutionPrice: 35000,
    personalPrice: 50000,
    visibility: 'all',
    stock: 15,
    status: 'on_sale',
    returnPolicy: { enabled: true, deadlineDays: 30, note: '收到货物7日内可申请退换，需保持原包装' },
    isBloodPack: false,
    createdAt: '2026-03-03T10:00:00Z',
    updatedAt: '2026-03-25T15:00:00Z',
  },

  // prod_015: visibility=all, 支持退换, 库存低
  {
    id: 'prod_015',
    name: '血浆速冻机',
    description: '用于新鲜血浆的快速冷冻，制冷速度快，温度均匀。',
    images: [],
    category: 'cat_equipment',
    specs: [
      { name: '制冷温度', value: '-40°C' },
      { name: '容量', value: '50袋' },
      { name: '功率', value: '1500W' },
    ],
    institutionPrice: 18000,
    personalPrice: 25000,
    visibility: 'all',
    stock: 4,
    status: 'on_sale',
    returnPolicy: { enabled: true, deadlineDays: 30, note: '收到货物7日内可申请退换，需保持原包装' },
    isBloodPack: false,
    createdAt: '2026-03-10T11:00:00Z',
    updatedAt: '2026-04-01T10:00:00Z',
  },

  // ── 服务 (cat_service) - 仅个人可见 ──────────────────────────

  // prod_016: visibility=personal_only, 支持退换, 库存充足
  {
    id: 'prod_016',
    name: '血型检测服务',
    description: '专业血型检测服务，提供 ABO 及 Rh 血型鉴定报告。',
    images: [],
    category: 'cat_service',
    specs: [
      { name: '服务类型', value: '到店检测' },
      { name: '报告时间', value: '1个工作日' },
      { name: '检测项目', value: 'ABO + Rh(D)' },
    ],
    institutionPrice: 0,
    personalPrice: 200,
    pointsPrice: 180,
    visibility: 'personal_only',
    stock: 999,
    status: 'on_sale',
    returnPolicy: { enabled: true, deadlineDays: 3, note: '未采样前可申请退款' },
    isBloodPack: false,
    createdAt: '2026-03-05T09:00:00Z',
    updatedAt: '2026-03-20T14:00:00Z',
  },

  // prod_017: visibility=personal_only, 不支持退换, 库存充足
  {
    id: 'prod_017',
    name: '献血后健康评估报告',
    description: '基于献血检测数据生成个性化健康评估报告，提供专业解读。',
    images: [],
    category: 'cat_service',
    specs: [
      { name: '报告类型', value: '电子版 + 纸质版' },
      { name: '出具时间', value: '3个工作日' },
      { name: '包含项目', value: '血常规、肝功能、传染病筛查' },
    ],
    institutionPrice: 0,
    personalPrice: 350,
    pointsPrice: 300,
    visibility: 'personal_only',
    stock: 999,
    status: 'on_sale',
    returnPolicy: { enabled: false, deadlineDays: 0, note: '检测服务已开展后不支持退款' },
    isBloodPack: false,
    createdAt: '2026-03-10T10:00:00Z',
    updatedAt: '2026-03-28T16:00:00Z',
  },

  // prod_018: visibility=personal_only, 支持退换, 库存低
  {
    id: 'prod_018',
    name: '亲子鉴定咨询服务',
    description: '专业亲子鉴定咨询服务，提供采样指导及结果解读。',
    images: [],
    category: 'cat_service',
    specs: [
      { name: '服务类型', value: '线上咨询 + 线下采样' },
      { name: '咨询时长', value: '30分钟/次' },
      { name: '出具时间', value: '5个工作日' },
    ],
    institutionPrice: 0,
    personalPrice: 800,
    visibility: 'personal_only',
    stock: 10,
    status: 'on_sale',
    returnPolicy: { enabled: true, deadlineDays: 7, note: '未采样前可申请全额退款' },
    isBloodPack: false,
    createdAt: '2026-03-18T08:00:00Z',
    updatedAt: '2026-04-05T11:00:00Z',
  },

  // prod_019: visibility=personal_only, 不支持退换, 库存充足
  {
    id: 'prod_019',
    name: '献血预约提醒服务',
    description: '智能献血周期管理，自动提醒下次献血时间，跟踪献血记录。',
    images: [],
    category: 'cat_service',
    specs: [
      { name: '服务周期', value: '1年' },
      { name: '提醒方式', value: '短信 + App推送' },
      { name: '附加服务', value: '献血证电子化' },
    ],
    institutionPrice: 0,
    personalPrice: 120,
    pointsPrice: 100,
    visibility: 'personal_only',
    stock: 999,
    status: 'on_sale',
    returnPolicy: { enabled: true, deadlineDays: 3, note: '服务未开通前可申请退款' },
    isBloodPack: false,
    createdAt: '2026-03-22T09:00:00Z',
    updatedAt: '2026-04-06T10:00:00Z',
  },

  // ── 已下架商品 ────────────────────────────────────────────────

  // prod_020: status=off_sale, 试剂盒
  {
    id: 'prod_020',
    name: '抗体效价测定试剂盒（已停产）',
    description: '用于 IgM 类抗体效价测定，该产品已停产，仅供历史订单参考。',
    images: [],
    category: 'cat_kit',
    specs: [
      { name: '规格', value: '20人份/盒' },
      { name: '状态', value: '已停产' },
    ],
    institutionPrice: 450,
    personalPrice: 550,
    visibility: 'all',
    stock: 0,
    status: 'off_sale',
    returnPolicy: { enabled: false, deadlineDays: 0, note: '已停产商品不支持退换' },
    isBloodPack: false,
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-04-10T09:00:00Z',
  },

  // prod_021: status=off_sale, 设备
  {
    id: 'prod_021',
    name: '半自动血型分析仪（升级换代）',
    description: '该型号已升级换代，推荐选购新款全自动血型分析仪（prod_014）。',
    images: [],
    category: 'cat_equipment',
    specs: [
      { name: '检测速度', value: '40样本/小时' },
      { name: '检测方法', value: '玻片法/试管法' },
      { name: '状态', value: '已停产' },
    ],
    institutionPrice: 8000,
    personalPrice: 12000,
    visibility: 'all',
    stock: 2,
    status: 'off_sale',
    returnPolicy: { enabled: false, deadlineDays: 0, note: '已停产商品不支持退换' },
    isBloodPack: false,
    createdAt: '2026-03-02T10:00:00Z',
    updatedAt: '2026-04-10T10:00:00Z',
  },
];
