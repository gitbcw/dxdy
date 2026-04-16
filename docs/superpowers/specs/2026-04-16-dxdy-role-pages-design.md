# 角色功能页面设计方案

## 1. 概述

**目标**：为小程序制单员和业务员角色实现完整的 MVP 功能页面，使用 mock 数据演示。

**设计风格**：延续医学实验室风格（青蓝 #0A6E7C + 琥珀金 #D4A853），专业简洁。

---

## 2. 目录结构

```
pages/
  clerk/                    # 制单员专属
    pending/
      pending.ts
      pending.wxml
      pending.wxss
      pending.json
    orders/
      orders.ts
      orders.wxml
      orders.wxss
      orders.json
  salesman/                 # 业务员专属
    commission/
      commission.ts
      commission.wxml
      commission.wxss
      commission.json
    customers/
      customers.ts
      customers.wxml
      customers.wxss
      customers.json
    promote/
      promote.ts
      promote.wxml
      promote.wxss
      promote.json
```

**页面注册**：每个页面需在 `app.json` 的 `pages` 数组中注册。

---

## 3. 制单员模块

### 3.1 待处理订单列表（pending）

**路由**：`/pages/clerk/pending/pending`

**功能**：展示待发货的订单列表，点击进入详情录入快递单号。

**Mock 数据结构**：
```typescript
interface ClerkOrder {
  id: string;
  orderNo: string;
  type: 'normal' | 'exchange';  // 普通 / 换货
  customerName: string;
  customerPhone: string;
  address: string;
  items: { name: string; quantity: number; specs: string }[];
  createdAt: string;
  assignedAt: string;  // 指派时间
}
```

**Mock 示例**（3-5条）：
- 普通订单：商品（宠物血包 x1）、客户（张先生/138****1234）
- 换货订单：商品（狗粮 x2）、关联原订单号、标注"换货"

**UI 布局**：
- 顶部：标题「待处理订单」+ 徽章数字
- 列表项：订单号、商品名、客户信息、状态标签（普通/换货）、指派时间
- 空状态：图标 + 「暂无待处理订单」

### 3.2 全部订单列表（orders）

**路由**：`/pages/clerk/orders/orders`

**功能**：展示所有指派给自己的订单，支持状态筛选。

**状态分类**：
- 待发货（等同于待处理）
- 已发货（已录入快递单号）
- 全部

**Mock 数据**：在待处理基础上增加已完成发货的订单（已录入快递单号）。

**UI 布局**：
- 顶部：Tab 筛选栏（待发货 / 已发货 / 全部）
- 列表项：同待处理 + 快递单号（已发货时显示）

### 3.3 订单详情 + 录入快递

**复用的页面**：`/pages/orders/order-detail/order-detail`

**改造点**：
- 检测 `globalData.userRole === 'clerk'` 时，详情页底部显示「录入快递」按钮
- 点击按钮 → 弹出快递公司选择面板

**快递公司选择弹窗**：
- 半透明遮罩 + 底部弹出面板
- 快递公司列表：顺丰速运、中通快递、圆通速递、韵达快递、申通快递、中国邮政
- 选择后 → 显示文本框输入快递单号
- 提交后更新订单状态为「已发货」，显示成功提示

---

## 4. 业务员模块

### 4.1 我的佣金（commission）

**路由**：`/pages/salesman/commission/commission`

**功能**：展示佣金汇总数据 + 提现入口。

**Mock 数据结构**：
```typescript
interface CommissionSummary {
  total: number;        // 累计佣金
  withdrawable: number; // 可提现
  withdrawn: number;     // 已提现
  pending: number;       // 待抵扣（退款/退货产生）
}
```

**Mock 示例**：
- 累计佣金：¥8,520.00
- 可提现：¥3,200.00
- 已提现：¥5,000.00
- 待抵扣：¥320.00（因某笔退货）

**UI 布局**：
- 顶部：大卡片展示核心数字（可提现 + 琥珀金强调色）
- 下方：小卡片展示累计/已提现/待抵扣
- 底部：「申请提现」按钮（可提现 > 100 时可点击）

**提现确认弹窗**：
- 显示：可提现金额、到账银行卡（mock：****6789）
- 「确认提现」按钮
- 提交后显示「申请已提交，审核中」

### 4.2 客户管理（customers）

**路由**：`/pages/salesman/customers/customers`

**功能**：展示绑定的客户列表。

**Mock 数据结构**：
```typescript
interface SalesmanCustomer {
  id: string;
  nickname: string;
  type: 'personal' | 'institution';
  phone: string;
  orderCount: number;      // 下单次数
  totalAmount: number;     // 累计消费
  exchangeCount: number;   // 退换货次数
  boundAt: string;         // 绑定时间
}
```

**Mock 示例**（5-8条）：
- 个人客户：李女士（个人消费者）、下单 3 次、累计 ¥1,280.00
- 机构客户：阳光宠物医院（机构客户）、下单 12 次、累计 ¥28,600.00
- 有退换货记录的客户单独标注

**UI 布局**：
- 顶部：客户总数 + 合计消费
- 列表项：头像（首字）、姓名/医院名、客户类型标签、下单次数、累计消费
- 点击客户：可展开详情（注册时间、最近下单时间、退换货记录）

### 4.3 推广工具（promote）

**路由**：`/pages/salesman/promote/promote`

**功能**：展示专属推广二维码 + 保存/分享。

**Mock 二维码**：
- 使用 `wxqrcode` 或生成包含推广码的 SVG
- 二维码内容：`https://dxdy.com/register?from=salesman_{userId}`

**UI 布局**：
- 中央：大尺寸二维码（300x300rpx）
- 下方：「保存图片」和「分享给好友」按钮
- 底部：推广链接文字 + 复制链接按钮

**交互**：
- 保存图片：使用 `wx.canvasToTempFilePath` 转为图片并保存
- 分享：使用 `wx.showShareMenu` 开启分享

---

## 5. 共享组件

### 5.1 状态标签

```xml
<view class="status-tag {{status}}">{{label}}</view>
```

样式：
- 待处理：青蓝底白字
- 已发货：绿底白字
- 换货：琥珀金底白字

### 5.2 空状态

```xml
<view class="empty-state">
  <image src="{{emptyIcon}}" class="empty-icon" />
  <text class="empty-text">{{message}}</text>
</view>
```

---

## 6. Mock 数据文件

在 `packages/miniprogram/miniprogram/services/mock-data.js` 新增：

```javascript
// 制单员 mock
exports.clerkOrders = [ ... ]

// 业务员 mock
exports.salesmanCustomers = [ ... ]
exports.commissionSummary = { ... }
```

---

## 7. 实现步骤

### Phase 1：制单员页面
1. 创建 `pages/clerk/pending/` 四个文件
2. 创建 `pages/clerk/orders/` 四个文件
3. 改造 `order-detail` 支持录入快递

### Phase 2：业务员页面
1. 创建 `pages/salesman/commission/` 四个文件
2. 创建 `pages/salesman/customers/` 四个文件
3. 创建 `pages/salesman/promote/` 四个文件

### Phase 3：集成测试
1. 切换角色验证页面可达
2. 验证交互流程完整
