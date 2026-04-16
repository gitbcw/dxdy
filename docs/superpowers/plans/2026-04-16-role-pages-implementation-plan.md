# 角色功能页面实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为小程序制单员和业务员实现完整的 MVP 功能页面（mock 数据）

**Architecture:**
- 新建 `pages/clerk/` 和 `pages/salesman/` 目录存放角色专属页面
- 复用 `services/index.js` 桥接层，从 `shared/lib` 获取服务
- Mock 数据写入 `packages/shared/src/mock/` 对应文件
- 延续医学实验室风格（青蓝 #0A6E7C + 琥珀金 #D4A853）

**Tech Stack:** 微信小程序原生开发，TypeScript，mock 数据

---

## 文件结构

```
pages/
  clerk/                          # 制单员目录（新建）
    pending/
      pending.ts/.wxml/.wxss/.json
    orders/
      orders.ts/.wxml/.wxss/.json
    order-detail/                  # 制单员订单详情（新建，与客户订单详情独立）
      order-detail.ts/.wxml/.wxss/.json
  salesman/                       # 业务员目录（新建）
    commission/
      commission.ts/.wxml/.wxss/.json
    customers/
      customers.ts/.wxml/.wxss/.json
    promote/
      promote.ts/.wxml/.wxss/.json

packages/shared/src/mock/
  clerk-orders.ts      # 新增：制单员订单 mock
  salesman.ts          # 新增：业务员客户 mock

packages/miniprogram/miniprogram/
  app.json             # 修改：注册新页面
  services/index.js    # 修改：导出新服务函数
```

---

## Phase 1: 基础设施准备

### Task 1: 添加 Mock 数据

**Files:**
- Create: `packages/shared/src/mock/clerk-orders.ts`
- Create: `packages/shared/src/mock/salesman.ts`
- Modify: `packages/shared/src/mock/index.ts`

**Mock 数据内容：**

`clerk-orders.ts` - 制单员订单（5条）：
```typescript
export const clerkPendingOrders = [
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
  // ... 共5条
]

export const clerkShippedOrders = [
  {
    id: 'ord_clerk_003',
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
  // ... 已发货订单
]
```

`salesman.ts` - 业务员客户和佣金：
```typescript
export const salesmanCustomers = [
  {
    id: 'cust_001',
    nickname: '李女士',
    type: 'personal',
    phone: '13912345678',
    orderCount: 3,
    totalAmount: 1280.00,
    exchangeCount: 0,
    boundAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'cust_002',
    nickname: '阳光宠物医院',
    type: 'institution',
    phone: '020-88888888',
    orderCount: 12,
    totalAmount: 28600.00,
    exchangeCount: 1,
    boundAt: '2026-02-15T14:30:00Z',
  },
  // ... 共8条
]

export const commissionSummary = {
  total: 8520.00,
  withdrawable: 3200.00,
  withdrawn: 5000.00,
  pending: 320.00,
}
```

### Task 2: 添加服务函数

**Files:**
- Modify: `packages/shared/src/services/index.ts` - 新增 `getClerkOrders`, `shipOrder`, `getSalesmanCustomers`, `getCommissionSummary`, `requestWithdrawal`
- Modify: `packages/shared/src/services/order.ts` - 新增 `shipOrder` 实现
- Modify: `packages/miniprogram/miniprogram/services/index.js` - 重新导出新服务

### Task 3: 注册新页面

**Files:**
- Modify: `packages/miniprogram/miniprogram/app.json` - 添加页面路径

```json
{
  "pages": [
    "pages/clerk/pending/pending",
    "pages/clerk/orders/orders",
    "pages/clerk/order-detail/order-detail",
    "pages/salesman/commission/commission",
    "pages/salesman/customers/customers",
    "pages/salesman/promote/promote"
  ]
}
```

---

## Phase 2: 制单员页面

### Task 4: 待处理订单列表（pending）

**Files:**
- Create: `pages/clerk/pending/pending.ts`
- Create: `pages/clerk/pending/pending.wxml`
- Create: `pages/clerk/pending/pending.wxss`
- Create: `pages/clerk/pending/pending.json`

**pending.ts 核心逻辑：**
```typescript
Page({
  data: {
    orders: [] as ClerkOrder[],
    isEmpty: false,
    iconClock: icons.clock,
    iconPhone: icons.phone,
  },

  onShow() {
    this.loadOrders()
  },

  async loadOrders() {
    // 调用 getClerkOrders({ status: 'pending' })
    // 仅返回待发货订单
  },

  onOrderTap(e: any) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/clerk/order-detail/order-detail?id=${id}` })
  },
})
```

**pending.wxml 结构：**
```
- 顶部导航栏（返回按钮 + 标题 + 徽章数字）
- 列表（block wx:for）
  - 订单卡片：订单号、状态标签（普通/换货）、商品、客户信息、指派时间
- 空状态
```

### Task 5: 全部订单列表（orders）

**Files:**
- Create: `pages/clerk/orders/orders.ts`
- Create: `pages/clerk/orders/orders.wxml`
- Create: `pages/clerk/orders/orders.wxss`
- Create: `pages/clerk/orders/orders.json`

**orders.ts 核心逻辑：**
```typescript
Page({
  data: {
    activeTab: 'pending',  // pending | shipped | all
    orders: [] as ClerkOrder[],
  },

  onTabChange(e: any) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    this.loadOrders()
  },

  async loadOrders() {
    // 调用 getClerkOrders({ status: this.data.activeTab })
  },
})
```

**orders.wxml 结构：**
```
- Tab 栏（待发货 / 已发货 / 全部）
- 列表项 + 快递信息（已发货时显示）
```

### Task 6: 制单员订单详情 + 录入快递

**Files:**
- Create: `pages/clerk/order-detail/order-detail.ts`
- Create: `pages/clerk/order-detail/order-detail.wxml`
- Create: `pages/clerk/order-detail/order-detail.wxss`
- Create: `pages/clerk/order-detail/order-detail.json`

**order-detail.ts 核心逻辑：**
```typescript
Page({
  data: {
    order: null as ClerkOrder | null,
    showExpressPanel: false,
    selectedCompany: '',
    expressNo: '',
    expressCompanies: ['顺丰速运', '中通快递', '圆通速递', '韵达快递', '申通快递', '中国邮政'],
  },

  onLoad(e: any) {
    const id = e.id
    this.loadOrder(id)
  },

  async loadOrder(id: string) {
    // 调用 getClerkOrderById(id)
  },

  onInputExpress() {
    this.setData({ showExpressPanel: true })
  },

  onSelectCompany(e: any) {
    this.setData({ selectedCompany: e.currentTarget.dataset.company })
  },

  onExpressNoInput(e: any) {
    this.setData({ expressNo: e.detail.value })
  },

  async onSubmitExpress() {
    // 调用 shipOrder({ orderId, expressCompany, expressNo })
    // 成功后 showToast 提示，关闭面板，刷新数据
  },

  onClosePanel() {
    this.setData({ showExpressPanel: false })
  },
})
```

**order-detail.wxml 结构：**
```
- 顶部导航（返回 + 订单号）
- 订单状态标签
- 客户信息区（姓名、电话、地址）
- 商品列表
- 快递信息区（已发货时显示）
- 底部按钮（未发货时显示「录入快递」按钮）
- 快递录入面板（半透明遮罩 + 底部弹出）
  - 快递公司选择（横向滚动 or 列表）
  - 单号输入框
  - 提交按钮
```

---

## Phase 3: 业务员页面

### Task 7: 我的佣金（commission）

**Files:**
- Create: `pages/salesman/commission/commission.ts`
- Create: `pages/salesman/commission/commission.wxml`
- Create: `pages/salesman/commission/commission.wxss`
- Create: `pages/salesman/commission/commission.json`

**commission.ts 核心逻辑：**
```typescript
Page({
  data: {
    summary: null as CommissionSummary,
    canWithdraw: false,  // 可提现 >= 100
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    const summary = await getCommissionSummary()
    this.setData({
      summary,
      canWithdraw: summary.withdrawable >= 100,
    })
  },

  onWithdraw() {
    wx.showModal({
      title: '确认提现',
      content: `可提现金额：¥${formatMoney(this.data.summary.withdrawable)}\n到账银行卡：****6789`,
      confirmText: '确认提现',
      success: async (res) => {
        if (res.confirm) {
          await requestWithdrawal({ amount: this.data.summary.withdrawable })
          wx.showToast({ title: '申请已提交，审核中' })
          this.loadData()
        }
      },
    })
  },
})
```

**commission.wxml 结构：**
```
- 顶部大卡片（可提现金额，琥珀金强调）
- 下方三列（累计佣金 / 已提现 / 待抵扣）
- 底部「申请提现」按钮
```

### Task 8: 客户管理（customers）

**Files:**
- Create: `pages/salesman/customers/customers.ts`
- Create: `pages/salesman/customers/customers.wxml`
- Create: `pages/salesman/customers/customers.wxss`
- Create: `pages/salesman/customers/customers.json`

**customers.ts 核心逻辑：**
```typescript
Page({
  data: {
    customers: [] as SalesmanCustomer[],
    totalAmount: 0,
  },

  onShow() {
    this.loadCustomers()
  },

  async loadCustomers() {
    const customers = await getSalesmanCustomers()
    const totalAmount = customers.reduce((sum, c) => sum + c.totalAmount, 0)
    this.setData({ customers, totalAmount })
  },
})
```

**customers.wxml 结构：**
```
- 顶部统计栏（客户总数 + 合计消费）
- 客户列表
  - 头像（首字）
  - 姓名/医院名 + 客户类型标签
  - 下单次数 | 累计消费
  - 退换货标签（有退换货时显示）
```

### Task 9: 推广工具（promote）

**Files:**
- Create: `pages/salesman/promote/promote.ts`
- Create: `pages/salesman/promote/promote.wxml`
- Create: `pages/salesman/promote/promote.wxss`
- Create: `pages/salesman/promote/promote.json`

**promote.ts 核心逻辑：**
```typescript
Page({
  data: {
    qrcodeUrl: '',  // 推广二维码 URL
   推广链接: '',
    userId: '',
  },

  onLoad() {
    const user = getApp().globalData.userInfo
    const userId = user?.id || 'unknown'
    this.setData({
      userId,
      qrcodeUrl: `https://dxdy.com/register?from=salesman_${userId}`,
      推广链接: `https://dxdy.com/register?from=salesman_${userId}`,
    })
    // 启用分享
    wx.showShareMenu({ withShareTicket: true })
  },

  onSaveQrcode() {
    // 使用 canvas 绘制二维码并保存
    // 简化：直接提示「长按图片保存」
    wx.showToast({ title: '请长按图片保存', icon: 'none' })
  },

  onCopyLink() {
    wx.setClipboardData({
      data: this.data.推广链接,
      success: () => wx.showToast({ title: '链接已复制' }),
    })
  },
})
```

**promote.wxml 结构：**
```
- 页面标题
- 中央二维码区域（使用 image 组件，src 为 qrcodeUrl）
- 下方按钮（保存图片 | 分享给好友）
- 底部推广链接 + 复制按钮
```

---

## Phase 4: 菜单集成

### Task 10: 绑定页面跳转

**Files:**
- Modify: `packages/miniprogram/miniprogram/pages/mine/mine.ts`

**mine.ts 修改：**
```typescript
// 在对应的 tap 处理函数中添加跳转

// 业务员菜单
onCommissionTap() {
  wx.navigateTo({ url: '/pages/salesman/commission/commission' })
},
onCustomersTap() {
  wx.navigateTo({ url: '/pages/salesman/customers/customers' })
},
onPromoteTap() {
  wx.navigateTo({ url: '/pages/salesman/promote/promote' })
},

// 制单员菜单
onPendingOrdersTap() {
  wx.navigateTo({ url: '/pages/clerk/pending/pending' })
},
onAllOrdersTap() {
  wx.navigateTo({ url: '/pages/clerk/orders/orders' })
},
onProfileTap() {
  wx.showToast({ title: '个人信息开发中', icon: 'none' })
},
```

---

## 验证清单

- [ ] 切换到「制单员」角色 → 我的 → 点击「待处理订单」→ 看到订单列表
- [ ] 点击订单 → 进入详情 → 点击「录入快递」→ 选择快递公司 → 填写单号 → 提交成功
- [ ] 切换到「业务员」角色 → 我的 → 点击「我的佣金」→ 看到佣金数据
- [ ] 点击「申请提现」→ 确认弹窗 → 提交成功提示
- [ ] 点击「客户管理」→ 看到客户列表
- [ ] 点击「推广工具」→ 看到二维码和链接
- [ ] 所有页面样式延续医学实验室风格
