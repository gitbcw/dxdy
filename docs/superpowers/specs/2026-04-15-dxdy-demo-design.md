# dxdy 演示版系统设计文档

> **日期**：2026-04-15
> **版本**：v1.0
> **性质**：演示版（Demo），全部 Mock 数据，不接入真实后端

---

## 1. 项目概述

基于 `req.md` v2.1 产品需求，构建一个完整的电商系统演示版。系统包含微信小程序端（客户、业务员、制单员三个角色）和 Web 管理后台（客服、商品管理员、系统管理员三个角色），全部使用 Mock 数据，不接入真实后端服务。

### 1.1 目标

- 展示 req.md 中定义的全部角色和核心业务流程
- 提供可交互的演示环境，用于产品验证和需求确认
- 为后续正式开发提供清晰的类型定义和业务逻辑参考

### 1.2 技术栈

| 端 | 技术选型 |
|---|---|
| 小程序端 | 微信小程序原生 TypeScript |
| Web 管理后台 | Next.js (App Router) + shadcn/ui + Tailwind CSS |
| 共享层 | TypeScript 类型定义 + Mock 数据 + 业务计算 |
| 包管理 | npm workspaces (Monorepo) |

---

## 2. 项目结构

```
dxdy/
├── packages/
│   ├── shared/                  # 共享层
│   │   ├── src/
│   │   │   ├── types/           # 全局类型定义
│   │   │   │   ├── user.ts      # 用户、角色、认证相关类型
│   │   │   │   ├── product.ts   # 商品、规格、库存类型
│   │   │   │   ├── order.ts     # 订单、预约、退换货类型
│   │   │   │   ├── commission.ts # 提成、提现类型
│   │   │   │   └── system.ts    # 系统配置类型
│   │   │   ├── mock/            # Mock 数据
│   │   │   │   ├── users.ts     # 各角色用户 Mock
│   │   │   │   ├── products.ts  # 商品列表 Mock
│   │   │   │   ├── orders.ts    # 订单列表 Mock
│   │   │   │   └── system.ts    # 系统配置 Mock
│   │   │   └── utils/           # 共享工具函数
│   │   │       ├── id.ts        # ID 生成
│   │   │       ├── format.ts    # 格式化（日期、金额）
│   │   │       └── calc.ts      # 业务计算（提成、积分、差价）
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── miniprogram/             # 微信小程序
│   │   ├── miniprogram/
│   │   │   ├── pages/
│   │   │   │   ├── index/       # 首页
│   │   │   │   ├── login/       # 登录注册
│   │   │   │   ├── products/    # 商品列表
│   │   │   │   ├── product-detail/ # 商品详情
│   │   │   │   ├── cart/        # 购物车
│   │   │   │   ├── checkout/    # 结算
│   │   │   │   ├── orders/      # 订单列表
│   │   │   │   ├── order-detail/ # 订单详情
│   │   │   │   ├── booking/     # 预约
│   │   │   │   ├── returns/     # 退换货
│   │   │   │   ├── profile/     # 个人中心
│   │   │   │   ├── salesperson/ # 业务员相关页面
│   │   │   │   └── clerk/       # 制单员相关页面
│   │   │   ├── components/      # 公共组件
│   │   │   ├── services/        # 服务层（调用 shared/mock）
│   │   │   ├── app.ts
│   │   │   ├── app.json
│   │   │   └── app.wxss
│   │   ├── project.config.json
│   │   └── tsconfig.json
│   │
│   └── admin/                   # Next.js 管理后台
│       ├── src/
│       │   ├── app/             # App Router 页面
│       │   │   ├── dashboard/
│       │   │   ├── products/
│       │   │   ├── orders/
│       │   │   ├── users/
│       │   │   ├── commissions/
│       │   │   ├── roles/
│       │   │   ├── system/
│       │   │   └── layout.tsx
│       │   ├── components/      # UI 组件
│       │   ├── lib/             # 工具库
│       │   └── services/        # 服务层
│       ├── package.json
│       └── tsconfig.json
│
├── package.json                 # workspace 根配置
├── req.md                       # 产品需求文档
└── docs/                        # 文档
```

---

## 3. 核心数据模型

### 3.1 用户体系

```typescript
// 基础用户
interface User {
  id: string;
  phone: string;
  nickname: string;
  avatar: string;
  role: 'customer' | 'salesperson' | 'clerk' | 'admin';
  createdAt: string;
}

// 客户
interface Customer extends User {
  role: 'customer';
  customerType: 'institution' | 'personal';
  verificationStatus: 'none' | 'pending' | 'approved' | 'rejected';
  verificationInfo?: {
    businessLicense: string;
    contactName: string;
    contactPhone: string;
    rejectReason?: string;
  };
  boundSalespersonId: string | null;
  wallet: {
    balance: number;
    rechargeHistory: RechargeRecord[];
  };
  points: {
    balance: number;
    history: PointsRecord[];
  };
  addresses: Address[];
}

// 业务员
interface Salesperson extends User {
  role: 'salesperson';
  verificationStatus: 'none' | 'pending' | 'approved' | 'rejected';
  verificationInfo: {
    realName: string;
    idCard: string;
    rejectReason?: string;
  };
  commission: {
    total: number;        // 累计提成
    available: number;    // 可提现
    withdrawn: number;    // 已提现
    pendingDeduction: number; // 待抵扣
  };
  bankCards: BankCard[];
  customers: string[];    // 绑定的客户 ID 列表
}

// 制单员
interface Clerk extends User {
  role: 'clerk';
  realName: string;
  assignedOrderIds: string[];
}

// 后台管理员
interface AdminUser {
  id: string;
  username: string;
  password: string;
  realName: string;
  phone: string;
  role: 'service' | 'product_manager' | 'system_admin';
  permissions: {
    canModifyPrice: boolean;
    [key: string]: boolean;
  };
  status: 'active' | 'disabled';
}
```

### 3.2 商品模型

```typescript
interface Product {
  id: string;
  name: string;
  description: string;
  images: string[];
  category: string;
  specs: ProductSpec[];
  institutionPrice: number;
  personalPrice: number;
  pointsPrice?: number;
  visibility: 'all' | 'institution_only' | 'personal_only';
  stock: number;
  status: 'on_sale' | 'off_sale';
  returnPolicy: {
    enabled: boolean;
    deadlineDays: number;
    note: string;
  };
  isBloodPack: boolean;
  testInfoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProductSpec {
  name: string;
  value: string;
}

interface PriceLog {
  originalPrice: number;
  modifiedPrice: number;
  operatorId: string;
  operatorName: string;
  operatedAt: string;
}
```

### 3.3 订单模型

```typescript
// 普通订单状态
type NormalOrderStatus =
  | 'pending_payment'   // 待支付
  | 'pending_shipment'  // 待发货
  | 'pending_receipt'   // 待收货
  | 'completed'         // 已完成
  | 'cancelled';        // 已取消

// 预约订单状态
type BookingOrderStatus =
  | 'pending_payment'       // 待支付
  | 'pending_confirmation'  // 待确认
  | 'confirmed'             // 预约已确认
  | 'in_service'            // 服务进行中
  | 'completed'             // 已完成
  | 'cancelled';            // 已取消

interface Order {
  id: string;
  type: 'normal' | 'booking';
  status: NormalOrderStatus | BookingOrderStatus;
  customerId: string;
  salespersonId: string;
  clerkId: string | null;
  items: OrderItem[];
  pricing: {
    originalAmount: number;
    actualAmount: number;
    priceLog: PriceLog[];
  };
  shipping: {
    address: Address;
    trackingNo: string | null;
    logistics: LogisticsInfo[];
  };
  booking?: {
    date: string;
    location: string;
    contactName: string;
    contactPhone: string;
  };
  returnRecordId: string | null;
  commission: {
    status: 'pending' | 'locked' | 'settled' | 'adjusted' | 'deducted';
    amount: number;
    settledAt: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

interface OrderItem {
  productId: string;
  productName: string;
  productImage: string;
  spec: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}
```

### 3.4 退换货模型

```typescript
type ReturnType = 'return' | 'exchange';
type ReturnStatus =
  | 'pending_review'      // 待审核
  | 'approved'            // 审核通过
  | 'rejected'            // 审核拒绝
  | 'pending_return_ship' // 待客户寄回
  | 'returned'            // 已寄回
  | 'verifying'           // 验货中
  | 'refunding'           // 退款中
  | 'return_completed'    // 退货完成
  | 'exchange_shipping'   // 换货发货中
  | 'exchange_completed'; // 换货完成

interface ReturnRecord {
  id: string;
  orderId: string;
  type: ReturnType;
  status: ReturnStatus;
  reason: string;
  items: ReturnItem[];
  refundAmount?: number;
  exchangeItem?: OrderItem;
  sendLogistics: { trackingNo: string; company: string } | null;
  receiveLogistics: { trackingNo: string; company: string } | null;
  verificationResult: 'pending' | 'qualified' | 'unqualified';
  commissionAdjust: {
    amount: number;
    reason: string;
  };
  reviewerId: string | null;
  reviewNote: string;
  createdAt: string;
  updatedAt: string;
}

interface ReturnItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}
```

### 3.5 系统配置

```typescript
interface SystemConfig {
  commissionRate: number;           // 提成比例 (0-1)
  commissionLockDays: number;       // 提成锁定天数
  minWithdrawAmount: number;        // 最低提现金额
  withdrawReviewEnabled: boolean;   // 提现审核开关
  paymentTimeoutMinutes: number;    // 订单支付超时（分钟）
  returnDeadlineDays: number;       // 退换货期限（天）
  returnAddress: string;            // 退换货收货地址
  reviewTimeoutHours: number;       // 审核超时提醒（小时）
  stockWarningThreshold: number;    // 库存预警值
  pointsRate: number;               // 积分获取比例（元:积分）
  pointsExpiryDays: number;         // 积分有效期（天，0=永不过期）
  rechargeTiers: RechargeTier[];    // 充值优惠档位
}

interface RechargeTier {
  amount: number;
  bonus: number;
}
```

---

## 4. 各端主流程

### 4.1 小程序端 — 客户流程

| 序号 | 页面 | 核心操作 |
|------|------|----------|
| 1 | 登录注册 | 选择身份（机构/个人），机构走实名认证 |
| 2 | 首页 | 商品分类导航、推荐商品、活动入口 |
| 3 | 商品列表/详情 | 按身份类型展示价格和可见商品 |
| 4 | 购物车 | 加购、改数量、删商品、库存校验 |
| 5 | 结算 | 选地址、确认订单、模拟支付 |
| 6 | 预约 | 选时间地点、模拟支付 |
| 7 | 订单列表 | 按 Tab 分类查看各状态订单 |
| 8 | 订单详情 | 改价通知、物流跟踪、确认收货 |
| 9 | 退换货 | 选择订单、填原因、上传凭证、跟踪进度 |
| 10 | 个人中心 | 钱包充值、积分兑换、地址管理、实名认证 |

### 4.2 小程序端 — 业务员流程

| 序号 | 页面 | 核心操作 |
|------|------|----------|
| 1 | 注册实名 | 提交实名信息，等待审核 |
| 2 | 推广中心 | 生成二维码、推广记录、客户管理 |
| 3 | 提成中心 | 提成明细、汇总、申请提现、提现记录 |

### 4.3 小程序端 — 制单员流程

| 序号 | 页面 | 核心操作 |
|------|------|----------|
| 1 | 登录 | 手机号+密码 |
| 2 | 待办列表 | 查看待发货订单（含换货任务） |
| 3 | 发货 | 录入快递单号（手动/扫码） |
| 4 | 订单列表 | 按状态查看已处理订单 |

### 4.4 Web 管理后台

| 序号 | 页面 | 核心操作 |
|------|------|----------|
| 1 | 登录 | 账号密码登录 |
| 2 | 仪表盘 | 数据概览（订单、商品、用户统计） |
| 3 | 商品管理 | 列表/新增/编辑/上下架、库存管理 |
| 4 | 订单管理 | 列表/详情/改价/指派制单员 |
| 5 | 退换货管理 | 审核/收货验货/退款/换货发货 |
| 6 | 用户管理 | 客户/业务员/制单员列表 |
| 7 | 角色权限 | 角色列表/编辑权限/账号管理 |
| 8 | 提成管理 | 提成数据/提现审核 |
| 9 | 系统配置 | 配置项列表/修改 |
| 10 | 操作日志 | 列表查看、按条件筛选 |

---

## 5. Mock 数据策略

### 5.1 核心原则

- **单一数据源**：所有 Mock 数据定义在 `packages/shared/src/mock/` 中
- **本地持久化**：Web 用 `localStorage`，小程序用 `wx.setStorageSync`
- **可切换身份**：登录时选择不同 Mock 用户，体验不同角色流程

### 5.2 Mock 数据集

| 数据 | 数量 | 说明 |
|------|------|------|
| 用户 | 10+ | 机构客户 3、个人客户 3、业务员 2、制单员 2、后台管理员 3 |
| 商品 | 20+ | 涵盖全部可见范围，含血包特殊商品 |
| 订单 | 30+ | 覆盖普通订单和预约订单的全状态流转 |
| 退换货 | 5+ | 含退货退款和换货两种类型 |
| 地址 | 5+ | 不同城市收货地址 |
| 系统配置 | 1 | req.md 第 6.4.4 节默认值 |

### 5.3 Mock 服务层

```
services/
├── auth.ts        # 模拟登录、注册、认证
├── product.ts     # 商品 CRUD（内存操作）
├── order.ts       # 订单操作（创建、改价、状态流转）
├── return.ts      # 退换货操作
├── commission.ts  # 提成核算、提现
├── user.ts        # 用户信息管理
└── system.ts      # 系统配置读写
```

每个服务函数模拟异步操作（`Promise` + 随机延迟 100-500ms），返回类型与真实 API 一致。

---

## 6. 实施分期

### Phase 1：基础设施

- Monorepo 搭建（npm workspaces）
- shared 包：类型定义 + Mock 数据 + 工具函数
- 复制小程序项目并调整引用

### Phase 2：小程序端核心流程

- 客户端：登录注册、商品浏览、购物车、结算、订单
- 业务员端：注册、推广、提成
- 制单员端：待办、发货

### Phase 3：Web 管理后台

- Next.js 项目初始化 + shadcn/ui 配置
- 登录、仪表盘、商品管理、订单管理
- 退换货管理、用户管理、系统配置、日志

### Phase 4：联调与完善

- 两端数据一致性验证
- UI 细节打磨
- 业务边界情况处理
