// ========== 制单员订单 ==========

export const clerkPendingOrders: Array<{
  id: string;
  orderNo: string;
  type: 'normal' | 'exchange';
  originalOrderNo?: string;
  customerName: string;
  customerPhone: string;
  address: string;
  items: { name: string; quantity: number; specs: string }[];
  createdAt: string;
  assignedAt: string;
  status: string;
}> = [
  {
    id: 'ord_clerk_001',
    orderNo: 'DD20260415001',
    type: 'normal',
    customerName: '张先生',
    customerPhone: '13812345678',
    address: '广东省广州市天河区珠江新城花城大道88号',
    items: [{ name: '宠物血包（犬）', quantity: 1, specs: '5mL/支' }],
    createdAt: '2026-04-15T10:30:00Z',
    assignedAt: '2026-04-15T11:00:00Z',
    status: 'pending',
  },
  {
    id: 'ord_clerk_002',
    orderNo: 'DD20260415002',
    type: 'exchange',
    originalOrderNo: 'DD20260410008',
    customerName: '李女士',
    customerPhone: '13987654321',
    address: '广东省深圳市福田区华强北路100号',
    items: [{ name: '狗粮（成犬配方）', quantity: 2, specs: '10kg/袋' }],
    createdAt: '2026-04-14T14:20:00Z',
    assignedAt: '2026-04-15T09:00:00Z',
    status: 'pending',
  },
  {
    id: 'ord_clerk_003',
    orderNo: 'DD20260415003',
    type: 'normal',
    customerName: '王女士',
    customerPhone: '13655556666',
    address: '广东省东莞市南城区鸿福路200号',
    items: [{ name: '宠物血包（猫）', quantity: 2, specs: '5mL/支' }],
    createdAt: '2026-04-15T08:00:00Z',
    assignedAt: '2026-04-15T10:00:00Z',
    status: 'pending',
  },
  {
    id: 'ord_clerk_004',
    orderNo: 'DD20260415004',
    type: 'normal',
    customerName: '赵先生',
    customerPhone: '13577778888',
    address: '广东省佛山市顺德区大良镇凤山西路10号',
    items: [{ name: '宠物健康检验套餐', quantity: 1, specs: '全面版' }],
    createdAt: '2026-04-14T16:00:00Z',
    assignedAt: '2026-04-15T09:30:00Z',
    status: 'pending',
  },
  {
    id: 'ord_clerk_005',
    orderNo: 'DD20260415005',
    type: 'exchange',
    originalOrderNo: 'DD20260409005',
    customerName: '陈先生',
    customerPhone: '13788889999',
    address: '广东省广州市越秀区中山五路88号',
    items: [{ name: '宠物食品套装', quantity: 1, specs: '标准装' }],
    createdAt: '2026-04-13T11:00:00Z',
    assignedAt: '2026-04-15T08:00:00Z',
    status: 'pending',
  },
]

export const clerkShippedOrders: Array<{
  id: string;
  orderNo: string;
  type: 'normal' | 'exchange';
  originalOrderNo?: string;
  customerName: string;
  customerPhone: string;
  address: string;
  items: { name: string; quantity: number; specs: string }[];
  createdAt: string;
  assignedAt: string;
  shippedAt?: string;
  expressCompany?: string;
  expressNo?: string;
  status: string;
}> = [
  {
    id: 'ord_clerk_101',
    orderNo: 'DD20260412003',
    type: 'normal',
    customerName: '王先生',
    customerPhone: '13722223333',
    address: '广东省佛山市禅城区季华五路50号',
    items: [{ name: '宠物玩具套装', quantity: 1, specs: '套装' }],
    createdAt: '2026-04-12T08:00:00Z',
    assignedAt: '2026-04-12T10:00:00Z',
    shippedAt: '2026-04-13T15:30:00Z',
    expressCompany: '顺丰速运',
    expressNo: 'SF1234567890',
    status: 'shipped',
  },
  {
    id: 'ord_clerk_102',
    orderNo: 'DD20260411002',
    type: 'exchange',
    originalOrderNo: 'DD20260408001',
    customerName: '周女士',
    customerPhone: '13899990000',
    address: '广东省深圳市南山区科技园路100号',
    items: [{ name: '宠物血包（犬）', quantity: 1, specs: '5mL/支' }],
    createdAt: '2026-04-11T09:00:00Z',
    assignedAt: '2026-04-11T11:00:00Z',
    shippedAt: '2026-04-12T14:00:00Z',
    expressCompany: '中通快递',
    expressNo: 'ZTK9876543210',
    status: 'shipped',
  },
]
