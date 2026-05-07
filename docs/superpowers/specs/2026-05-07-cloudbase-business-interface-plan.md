# CloudBase 业务数据与接口改造对照

> 日期：2026-05-07  
> 背景：小程序 UI 已完成第一、二批对齐。下一阶段以项目级 CloudBase 环境为真实数据源，不再以 `packages/shared` 作为业务基准。

## 1. 改造原则

- 现有集合优先复用，缺字段时在现有文档结构内扩展。
- 小程序页面先接真实读写，再把复杂规则逐步下沉云函数。
- 文件类资料统一进入云存储，数据库只保存 `fileID`。
- 用户登录态更新后必须同步 `getApp().globalData.userInfo` 和本地 `current_user`。
- 待支付订单改价必须保留，后续订单支付和提成计算都要继续兼容 `pricing.priceLog`。

## 2. 已接入第一批

### 2.1 医院认证

页面：

- `packages/miniprogram/miniprogram/pages/verify/verify`

集合：

- `users`

用户字段：

- `verificationStatus`: `none | pending | approved | rejected`
- `verificationInfo.businessLicense`: 营业执照云存储 `fileID`
- `verificationInfo.sitePhoto`: 经营场所照片云存储 `fileID`
- `verificationInfo.hospitalName`: 医院名称
- `verificationInfo.legalPerson`: 法人名称
- `verificationInfo.contactName`: 联系人
- `verificationInfo.contactPhone`: 联系电话
- `verificationInfo.region`: 所在地区
- `verificationInfo.address`: 详细地址
- `verificationInfo.submittedAt`: 提交时间
- `verificationInfo.rejectReason`: 驳回原因
- `updatedAt`: 用户资料更新时间

服务入口：

- `submitVerification(userId, info)`

当前状态：

- 已上传本地临时图片到云存储。
- 已写入 `users.verificationInfo` 并将 `verificationStatus` 置为 `pending`。
- 已同步小程序全局用户与本地缓存。

待后续补齐：

- 后台审核通过/驳回能力。
- 审核通过后是否同步 `customerType = institution`，需要结合后台业务规则确认。
- 资质文件访问权限规则。

### 2.2 收货地址

页面：

- `packages/miniprogram/miniprogram/pages/mine/address/address`
- `packages/miniprogram/miniprogram/pages/orders/create/create`

集合：

- `users`

用户字段：

- `addresses[].id`: 地址 ID
- `addresses[].name`: 收货人
- `addresses[].phone`: 手机号
- `addresses[].province`: 当前先保存页面输入的地区文本
- `addresses[].city`: 预留
- `addresses[].district`: 预留
- `addresses[].detail`: 详细地址
- `addresses[].hospitalName`: 医院名称
- `addresses[].isDefault`: 是否默认
- `addresses[].createdAt`: 创建时间
- `addresses[].updatedAt`: 更新时间

服务入口：

- `saveAddress(customerId, address)`
- `deleteAddress(customerId, addressId)`

当前状态：

- 已从当前用户读取真实地址。
- 新增、编辑、默认地址、删除地址已写回 CloudBase。
- 删除默认地址后会自动设置剩余第一条为默认地址。
- 保存后同步小程序全局用户与本地缓存，下单页可读取最新地址。

待后续补齐：

- 地区选择器拆分省/市/区字段。
- 地址安全规则校验：用户只能修改自己的 `addresses`。
- 地址保存失败时的错误明细展示。

## 3. 下一批建议

### 3.1 支付结果与订单支付状态

页面：

- `pages/orders/pay-result/pay-result`
- `pages/orders/order-detail/order-detail`

集合：

- `orders`

建议字段：

- `payment.status`: `unpaid | paid | refunded`
- `payment.method`: `wechat | wallet | offline`
- `payment.paidAt`
- `payment.transactionId`
- `payment.amount`: 实付金额，使用 `pricing.actualAmount`
- `status`: 支付后由 `pending_payment` 改为 `pending_shipment` 或预约类状态

当前状态：

- 已在 `createOrder` 中生成 `orderNo` 和 `payment.unpaid` 初始结构。
- 已新增 `payOrder(orderId, method)`，只允许 `pending_payment` 订单支付。
- 支付成功后普通订单进入 `pending_shipment`，预约订单进入 `pending_confirmation`。
- 支付结果页已按订单 ID 读取真实订单金额、支付方式、支付时间和预约信息。
- 下单后仍保留 `pending_payment` 状态并进入订单详情，避免破坏“待支付订单后台改价”窗口；用户在订单详情点击“去支付”后进入支付结果页。

### 3.2 售后申请与售后进度

页面：

- `pages/returns/apply/apply`
- `pages/returns/detail/detail`

集合：

- `returns`
- `orders`

建议字段：

- `returns.orderId`
- `returns.afterNo`
- `returns.customerId`
- `returns.type`: `refund_return | refund_only | exchange`
- `returns.reason`
- `returns.description`
- `returns.vouchers[]`: 云存储 `fileID`
- `returns.refundAmount`
- `returns.status`
- `returns.timeline[]`
- `orders.returnRecordId`

当前状态：

- 已扩展 `createReturn`，支持上传售后凭证到云存储。
- 已写入 `afterNo`、`customerId`、`description`、`vouchers`、`refundAmount`、`timeline` 等字段。
- 创建售后后会回写 `orders.returnRecordId`。
- 售后申请页已按 `orderId` 读取订单商品、规格、数量和实际金额。
- 售后进度页已支持按 `id` 或 `orderId` 读取真实售后记录，并展示状态、时间线、商家留言和退款金额。

待后续补齐：

- 后台/客服审核动作：通过、驳回、等待寄回、质检、退款中、完成。
- 售后凭证文件访问权限。
- 售后类型与提成扣减规则联动。

### 3.3 发票申请

页面：

- `pages/invoice/apply/apply`

建议集合：

- `invoices`

建议字段：

- `customerId`
- `orderId`
- `invoiceType`
- `title`
- `taxNo`
- `email`
- `amount`
- `status`
- `createdAt`

当前状态：

- 已新增 `createInvoice(params)`，写入 `invoices` 集合。
- 已新增 `getInvoices(options)` 与 `getInvoiceByOrderId(orderId)`，支持按用户、订单和状态读取发票申请。
- 发票申请页已支持从订单详情带 `orderId` 进入，自动读取真实订单号与 `pricing.actualAmount`。
- 从“我的-发票申请”进入时，可输入订单号并通过真实订单解析订单 ID 与开票金额。
- 仅允许已支付订单提交发票申请，同一订单重复申请会被拦截。

待后续补齐：

- 后台开票处理：待处理、已开票、驳回、发票文件 `fileID`。
- 纸质发票邮寄信息与物流状态。
- 发票抬头历史和默认抬头管理。

### 3.4 物流跟踪

页面：

- `pages/logistics/detail/detail`

集合：

- `orders`

建议字段：

- `shipping.company`
- `shipping.trackingNo`
- `shipping.shippedAt`
- `shipping.eta`
- `shipping.temperature`
- `shipping.logistics[]`

当前状态：

- `shipOrder(orderId, trackingNo, company)` 与 `clerkShipOrder(params)` 已写入 `shipping.company`、`shipping.trackingNo`、`shipping.shippedAt`、`shipping.eta`、`shipping.temperature` 和 `shipping.logistics[]`。
- 制单员录入快递后，普通订单进入 `pending_receipt`，客户可立即从订单列表或订单详情进入物流页。
- 物流详情页已按 `orderId` 读取真实订单，展示订单号、物流公司、单号、发货时间、预计送达、温控信息和物流时间线。
- 未发货订单会显示待发货状态，不再使用静态物流示例数据。

待后续补齐：

- 后台/制单员追加物流节点能力，如揽收、转运、派送、签收、异常。
- 第三方物流接口同步或云函数定时刷新。
- 冷链温度曲线或温控异常记录。

### 3.5 检测报告查询

页面：

- `pages/tests/query/query`
- `pages/tests/report/report`

建议集合：

- `test_reports`

建议字段：

- `code`
- `productName`
- `batchNo`
- `bloodType`
- `collectedAt`
- `testedAt`
- `validUntil`
- `items[]`
- `storage`
- `transport`
- `conclusion`
- `reportFileID`

当前状态：

- 已新增 `getTestReports(options)` 与 `getTestReportByCode(code)`，从 `test_reports` 集合按血包编号或批次号读取真实报告。
- 检测查询页已支持扫码或输入编号查询真实报告，查询成功后写入本地最近查询记录。
- 检测报告详情页已展示真实 `productName`、`batchNo`、`bloodType`、采集/检测/有效期、检测项目、储存运输和结论。
- `reportFileID` 存在时可通过云存储下载并打开报告文件；没有文件时展示暂无报告文件。
- 订单详情的“电子检测报告”已跳转到检测查询页。

待后续补齐：

- 后台维护检测报告与上传报告文件。
- 报告查询权限规则：按公开检测码可查，后台可维护。
- 订单商品与检测报告的直接关联字段，如 `items[].testReportCode` 或 `items[].batchNo`。

## 4. 权限待办

- `users`: 用户只能读写自己的基础资料、地址和认证申请字段；审核字段由后台角色写。
- `orders`: 客户只能读取自己的订单；制单员读取分配给自己的订单；代理商读取自己绑定客户的汇总数据。
- `returns`: 客户只能创建和读取自己的售后；后台/客服审核。
- `invoices`: 客户只能创建和读取自己的发票申请。
- `test_reports`: 客户可按血包编号/检测码查询；后台维护报告。
