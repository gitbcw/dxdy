# UI + 功能对照验收清单

> 日期：2026-05-07  
> 对照来源：
> - UI 清单：`docs/superpowers/plans/2026-05-07-miniprogram-ui-alignment-plan.md`
> - 业务对照：`docs/superpowers/specs/2026-05-07-cloudbase-business-interface-plan.md`
> - 云端基线：`docs/superpowers/specs/2026-05-07-cloudbase-collections-security-baseline.md`

## 1. 当前阶段判断

原定路径：

1. 先做 UI 对齐清单。
2. 第一轮只改小程序 UI。
3. 再按变更文档补业务功能。
4. 最后做 UI + 功能对照优化。

当前进度：

- UI 对齐清单：已完成。
- 客户侧 UI 第一轮：基本完成。
- 客户侧扩展业务接入：医院认证、地址、支付结果、售后、发票、物流、检测报告已接入 CloudBase 服务层。
- 云端结构与权限：已形成本地基线文档、索引 JSON、安全规则 JSON；已通过项目 `.mcp.json` 直连 `cloudbase-d4gwpsm7gcc59b6fc`，完成新增集合、索引、最小安全规则和 `createOrder/payOrder/createInvoice/createReturn/clerkShipOrder/adjustOrderPrice/updateOrderStatus/submitAgentApplication/reviewAgentApplication/saveAgentBankCard/requestWithdrawal/reviewReturn/reviewWithdrawal/processInvoice/reviewVerification` 云函数部署。
- 代理商侧：已有推广、客户、提成等基础页，但与设计图相比缺少申请、审核状态、客户详情、订单视角、提现/银行卡等闭环页面。
- 制单员侧：已有待处理、订单列表、订单详情和录入物流弹层，但缺少独立录入物流、发货成功、物流详情/修改物流等履约闭环页面。

## 2. 客户侧验收

| 页面/链路 | UI 状态 | 功能状态 | 结论 | 下一步 |
| --- | --- | --- | --- | --- |
| 登录/注册 | 已按设计图方向重构 | 仍使用手机号/角色式登录逻辑 | 部分完成 | 后续改为真实 Auth 登录，弱化测试入口 |
| 首页 | 已对齐客户首页信息层级 | 已接商品、订单、角色分支 | 基本完成 | 补真实 banner/商品图片、未认证血包权限提示细节 |
| 商品分类 | 已对齐搜索、分类、商品卡 | 已接 `products/categories` | 基本完成 | P0 补血包购买权限强校验，不能只靠 UI 锁定 |
| 商品详情 | 已对齐商品详情结构 | 已接商品详情 | 基本完成 | P0 补下单前商品权限、库存、认证状态校验 |
| 确认订单 | 已对齐订单确认 UI | 已创建真实订单，保留待支付状态 | 部分完成 | P0 下沉 `createOrder` 云函数，补库存/权限/运费/优惠券 |
| 支付结果 | 已新增并接真实订单 | `payOrder` 已云函数化，目前仍是模拟支付状态更新 | 基本完成 | P1 后续接真实支付回调 |
| 订单列表/详情 | 已用 `order-detail` 兼容列表+详情 | 已接真实订单、售后、支付、物流、发票入口 | 基本完成 | 可后续拆 `pages/orders/list/list`，当前不阻塞 |
| 售后申请/进度 | 已新增并对齐 UI | 已创建 `returns`，回写订单，展示进度；`createReturn`、`reviewReturn` 已云函数化 | 基本完成 | P1 补客服审核 UI 和退款/换货通知 |
| 发票申请 | 已新增并对齐 UI | 已写 `invoices`，校验支付和重复申请；`createInvoice`、`processInvoice` 已云函数化 | 基本完成 | P1 补后台开票 UI、通知和纸票邮寄细节 |
| 收货地址 | 已对齐地址卡和表单 | 已写回 `users.addresses` | 基本完成 | P1 省市区拆分；安全规则收口 |
| 物流跟踪 | 已新增并对齐 UI | 已读 `orders.shipping`，制单员发货已云函数化 | 基本完成 | P1 补追加物流节点、物流异常、温控记录 |
| 检测查询/报告 | 已新增并对齐 UI | 已查 `test_reports`，支持 `reportFileID` 打开 | 部分完成 | P0 确认/创建 `test_reports`；P1 后台维护报告 |
| 我的 | 已对齐客户个人中心 | 已接订单计数和菜单入口 | 基本完成 | P1 根据角色补菜单权限和消息状态 |
| 医院认证 | 已对齐认证表单/状态 | 已上传云存储并写 `users.verificationInfo`；`reviewVerification` 已云函数化 | 基本完成 | P1 补后台审核 UI、资质文件权限规则和通知 |

客户侧 P0 缺口：

1. `createOrder`、`payOrder`、`createInvoice`、`createReturn`、`clerkShipOrder`、`adjustOrderPrice`、`updateOrderStatus` 已云函数化。
2. 后台 Web 端仍主要使用 `@dxdy/shared` mock 服务，后续真实后台接 CloudBase 时应复用已部署云函数。
3. `invoices`、`test_reports` 集合已在项目级环境创建并配置基础索引和最小安全规则。
4. `users`、`orders`、`returns` 等旧集合安全规则尚未收紧，需等云函数链路稳定后逐步应用。

## 3. 代理商侧验收

| 页面/链路 | UI 状态 | 功能状态 | 结论 | 下一步 |
| --- | --- | --- | --- | --- |
| 代理商申请 | 已新增 `pages/agent/apply/apply` | 通过 `submitAgentApplication` 云函数写入申请，通过 `reviewAgentApplication` 云函数审核 | 基本完成 | P1 补后台审核 UI 和通知 |
| 代理商审核状态 | 已新增 `pages/agent/verify-status/verify-status` | 读取 `agentStatus` 并展示审核中/通过/驳回 | 基本完成 | P1 接通知和审核详情 |
| 代理商工作台 | 复用首页销售分支，已补代理状态/客户管理/提成/推广入口 | 有客户、提成、推广基础数据 | 部分完成 | P1 后续统一 agent 路由和四 tab 结构 |
| 推广二维码 | 已有 `salesman/promote` 并完成第一轮 UI | 以现有用户/推广信息为主 | 部分完成 | P0 路由逐步从 salesman 过渡到 agent |
| 推广客户 | 已有 `salesman/customers`，已改代理商文案 | 已读绑定客户，并聚合订单数、累计成交、本月成交、售后次数 | 基本完成 | P1 继续补搜索和成交趋势 |
| 客户详情 | 已新增 `pages/agent/customer-detail/customer-detail` | 已读客户、最近订单、成交统计、贡献提成 | 基本完成 | P1 补成交趋势图 |
| 客户订单/代理订单 | 已新增 `pages/agent/orders/orders` | 已按 `salespersonId` 查询并展示客户、订单、金额、提成、售后状态 | 基本完成 | P1 补订单搜索和代理商详情分支 |
| 提成中心 | 已有 `salesman/commission`，提现按钮已跳转资金页 | 已读 `commission_records/users.commission` | 基本完成 | P1 补冻结/预计到账规则展示 |
| 提现/银行卡 | 已新增 `pages/agent/withdraw/withdraw` | 通过 `saveAgentBankCard`、`requestWithdrawal`、`reviewWithdrawal` 云函数保存银行卡、提交提现、审核/驳回/打款 | 基本完成 | P1 补后台审核 UI 和打款通知 |
| 代理商我的 | 复用 `mine`，已补客户管理、提现与银行卡入口 | 有角色菜单分支 | 部分完成 | P1 统一 agent 四 tab 与我的页信息卡 |

代理商侧 P0 缺口：

1. 代理商业务仍沿用 `salesman` 命名，短期可保留，后续应统一“代理商”文案与路由。
2. 代理商申请和审核已下沉云函数，后续应接后台审核 UI 和通知。
3. 银行卡保存、提现申请、提现审核/驳回/打款已下沉云函数，后续应补后台审核 UI 和打款通知。

## 4. 制单员侧验收

| 页面/链路 | UI 状态 | 功能状态 | 结论 | 下一步 |
| --- | --- | --- | --- | --- |
| 任务通知/待处理订单 | 已用 `clerk/pending` 对齐第一轮 | 已读待发货/待确认订单 | 基本完成 | P1 补真实通知与紧急/今日预约筛选 |
| 制单员订单详情 | 已有页面 | 已读订单，弹层录入物流；服务层已兼容真实订单字段 | 部分完成 | P0 补备货状态、冷链字段、温控信息 |
| 录入物流 | 当前在详情弹层 | 已通过 `clerkShipOrder` 云函数写 `shipping` 字段和操作日志 | 基本完成 | P1 新增/重构独立录入物流页或增强弹层字段 |
| 发货成功 | 缺页 | 提交成功后返回详情 | 未完成 | P1 新增成功页 |
| 已发货订单 | 已有 `clerk/orders` | 可按状态读取 | 部分完成 | P0 补今日发货、配送中、已签收视角 |
| 物流跟踪/修改物流 | 缺制单员独立页 | 客户物流页已可读 | 未完成 | P1 新增制单员物流详情和修改物流 |

制单员侧 P0 缺口：

1. 录入物流字段不足：缺包装类型、冷链方式、重量、箱内温度、修改原因。
2. 订单详情缺备货中/发货中等履约状态流转。
3. 已发货订单列表需要从“订单列表”变成“履约视角”。

## 5. 云端与安全验收

| 项目 | 当前状态 | 风险 | 下一步 |
| --- | --- | --- | --- |
| 项目级环境访问 | 已通过项目 `.mcp.json` 直连 `cloudbase-d4gwpsm7gcc59b6fc` | 已挂载全局 MCP 仍指向测试环境，后续操作需继续使用项目级 MCP 子进程 | 保持项目级 MCP 调用方式 |
| `invoices` 集合 | 已创建，已加索引和最小安全规则 | 后台开票 UI 未做 | P1 补后台开票页面、通知和纸票邮寄细节 |
| `test_reports` 集合 | 已创建，已加索引和最小安全规则 | 暂无后台维护报告能力 | P1 补后台维护与报告上传 |
| 索引 | `invoices`、`test_reports` 已应用；其他集合有草案 | `orders/returns/users` 尚未补齐 | 后续按需检查并补充 |
| 安全规则 | `invoices`、`test_reports` 已应用；核心旧集合暂未收紧 | 旧集合仍存在直写风险 | 云函数稳定后逐步收紧 |
| `customerOpenid` | 新订单/售后/发票已写入 | 老数据缺字段 | 后续写迁移脚本或兼容 `_openid` |
| 云函数 | 已有 `getOpenId`、`createOrder`、`payOrder`、`createInvoice`、`createReturn`、`clerkShipOrder`、`adjustOrderPrice`、`updateOrderStatus`、`submitAgentApplication`、`reviewAgentApplication`、`saveAgentBankCard`、`requestWithdrawal`、`reviewReturn`、`reviewWithdrawal`、`processInvoice`、`reviewVerification` | 关键写操作已完成基础版，后台 UI 和通知仍需补齐 | 下一步补后台审核 UI 或通知 |

## 6. 推荐执行顺序

### Step 1：客户侧 P0 云函数化

优先做 `createOrder` 云函数。

原因：

- 下单是所有后续订单、支付、售后、物流、提成的源头。
- 血包购买权限、认证状态、库存、商品可见性、地址和金额模型都应该在这里强校验。
- 完成后可以顺带把 `customerOpenid` 写入新订单，为安全规则收口铺路。

验收：

- 普通商品可下单。
- 血包商品仅认证医院客户可下单。
- 未登录/未认证/商品下架/库存不足时返回明确错误。
- 下单后仍保留 `pending_payment`，不破坏后台改价窗口。

执行状态：已本地完成并已部署到项目级 CloudBase 环境。

已落地：

- 新增云函数：`packages/miniprogram/cloudfunctions/createOrder`
- 小程序服务层：`createOrder(params)` 已切到 `wx.cloud.callFunction({ name: 'createOrder' })`
- 下单页：已补提交失败提示，云函数返回错误时不再静默失败
- 云函数校验：登录 openid、客户归属、商品存在、商品上架、客户类型可见性、血包仅已认证医院购买、库存基础校验、预约信息、收货地址
- 云函数写入：保留原订单字段结构，并写入 `customerOpenid`
- 云端状态：`createOrder` 函数运行时 `Nodejs18.15`，状态 `Active / Available`

已验证：

- `npm run typecheck -w packages/miniprogram`
- `node --check packages/miniprogram/cloudfunctions/createOrder/index.js`

### Step 2：发票和售后云函数化

优先级：

1. `createInvoice`
2. `createReturn`

原因：

- 两个链路都依赖订单归属和状态校验。
- 当前已经有 UI 和前端服务，可平滑替换为云函数调用。

执行状态：已完成并部署到项目级 CloudBase 环境。

已落地：

- 新增云函数：`packages/miniprogram/cloudfunctions/createInvoice`
- 新增云函数：`packages/miniprogram/cloudfunctions/createReturn`
- 小程序服务层：`createInvoice(params)`、`createReturn(params)` 已切到 `wx.cloud.callFunction`
- 售后页：已补云函数错误提示，重复申请/状态不可申请等错误会展示给用户
- `createInvoice` 校验：登录 openid、订单归属、订单已支付、重复申请、发票抬头和邮箱
- `createReturn` 校验：登录 openid、订单归属、订单状态、重复申请、退款金额上限
- 云端状态：两个函数运行时均为 `Nodejs18.15`，状态均为 `Active / Available`

已验证：

- `npm run typecheck -w packages/miniprogram`
- `node --check packages/miniprogram/cloudfunctions/createInvoice/index.js`
- `node --check packages/miniprogram/cloudfunctions/createReturn/index.js`

### Step 3：制单员发货云函数化

目标：

- 下沉 `clerkShipOrder`。
- 补包装类型、冷链方式、重量、箱内温度。
- 记录操作日志。

执行状态：基础版已完成并部署到项目级 CloudBase 环境。

已落地：

- 新增云函数：`packages/miniprogram/cloudfunctions/clerkShipOrder`
- 小程序服务层：`clerkShipOrder(params)` 已切到 `wx.cloud.callFunction`
- 制单员订单服务：新增真实订单到旧 UI 字段的兼容映射，保留 `rawStatus`，并映射 `pending/shipped`、`expressCompany/expressNo`、客户地址、订单金额、商品规格价格等展示字段
- 订单详情页：云函数返回的权限/状态错误会直接展示给制单员
- 云函数校验：登录 openid、业务用户角色、订单存在、订单状态、订单指派归属；老业务账号首次使用时绑定 `boundOpenid`
- 云函数写入：`shipping.trackingNo/company/shippedAt/eta/temperature/logistics`，并将订单流转到 `pending_receipt`
- 操作日志：写入 `logs` 集合，记录操作人、动作、目标订单和物流单号
- 云端状态：函数运行时 `Nodejs18.15`，状态 `Active / Available`

已验证：

- `npm run typecheck -w packages/miniprogram`
- `node --check packages/miniprogram/cloudfunctions/clerkShipOrder/index.js`

### Step 2.5：支付云函数化

目标：

- 下沉 `payOrder`。
- 校验订单归属、待支付状态、订单金额。
- 支付后写入 `payment.status/method/paidAt/transactionId/amount`，并按订单类型流转状态。

执行状态：已完成并部署到项目级 CloudBase 环境。

已落地：

- 新增云函数：`packages/miniprogram/cloudfunctions/payOrder`
- 小程序服务层：`payOrder(orderId, method)` 已切到 `wx.cloud.callFunction`
- `payOrder` 校验：登录 openid、订单归属、待支付状态、订单金额
- 状态流转：普通订单支付后进入 `pending_shipment`，预约订单支付后进入 `pending_confirmation`
- 云端状态：函数运行时 `Nodejs18.15`，状态 `Active / Available`

已验证：

- `npm run typecheck -w packages/miniprogram`
- `node --check packages/miniprogram/cloudfunctions/payOrder/index.js`

### Step 4：代理商 P0 补页

目标：

- 新增代理商申请。
- 新增审核状态。
- 完成代理商四 tab 闭环。

### Step 5：云端集合和权限应用

执行：

- `invoices`、`test_reports` 已创建。
- 新增集合索引已应用。
- 新增集合安全规则已应用。
- 后续再逐步收紧 `orders`、`returns`、`users`。

## 7. 本轮建议马上开工项

建议下一步直接做：

**P0-2：新增 `adjustOrderPrice` 云函数，并将后台/客服改价入口切到云函数调用。**

范围：

- 新增云函数：`packages/miniprogram/cloudfunctions/adjustOrderPrice`
- 服务层改造：`adjustOrderPrice(orderId, newPrice, operatorId, operatorName)` 调用云函数
- 校验：登录、客服/管理员角色、订单存在、仅待支付可改价、新价格小于原价且大于 0
- 写入：`pricing.actualAmount`、`pricing.priceLog`、`commission.amount`、`logs`

暂不做：

- 真实支付回调
- 库存扣减事务
- 优惠券、运费、加急费

执行状态：基础版已完成并部署到项目级 CloudBase 环境。

已落地：

- 新增云函数：`packages/miniprogram/cloudfunctions/adjustOrderPrice`
- 小程序服务层：`adjustOrderPrice(orderId, newPrice, operatorId, operatorName)` 已切到 `wx.cloud.callFunction`
- 云函数校验：登录 openid、业务用户角色/权限、订单存在、仅待支付可改价、新价格必须大于 0 且低于当前应付金额；老业务账号首次使用时绑定 `boundOpenid`
- 云函数写入：`pricing.actualAmount`、`pricing.priceLog`、`commission.amount`、`payment.adjustedAt`、`updatedAt`
- 操作日志：写入 `logs` 集合，记录操作人、动作、目标订单和改价前后金额
- 云端状态：函数运行时 `Nodejs18.15`，状态 `Active / Available`

已验证：

- `npm run typecheck -w packages/miniprogram`
- `node --check packages/miniprogram/cloudfunctions/adjustOrderPrice/index.js`

下一步建议：

**P0-3：补代理商工作台数据结构与客户详情入口。**

代理商申请/审核状态执行状态：已完成第一版。

已落地：

- 新增页面：`packages/miniprogram/miniprogram/pages/agent/apply`
- 新增页面：`packages/miniprogram/miniprogram/pages/agent/verify-status`
- 新增服务：`submitAgentApplication`、`getAgentApplication`，其中申请提交已切到云函数
- 首页入口：普通客户可进入申请/状态，代理商首页展示“代理状态”
- 我的入口：客户菜单新增“代理商申请”，代理商菜单新增“代理商状态”

已验证：

- `npm run typecheck -w packages/miniprogram`
- `packages/miniprogram/miniprogram/app.json` JSON 解析通过

执行状态：代理商工作台数据结构与客户详情入口已完成第一版。

已落地：

- 新增页面：`packages/miniprogram/miniprogram/pages/agent/customer-detail`
- `getSalesmanCustomers` 已聚合绑定客户的订单数、累计成交、本月成交、售后次数、最近订单
- 新增服务：`getAgentCustomerDetail`
- `salesman/customers` 已改代理商客户工作台文案、筛选和详情跳转
- 首页/我的页已增加代理商客户管理入口

已验证：

- `npm run typecheck -w packages/miniprogram`
- `packages/miniprogram/miniprogram/app.json` JSON 解析通过

下一步建议：

**P0-4：补代理商提现/银行卡页面。**

执行状态：代理商提现/银行卡页面已完成第一版。

已落地：

- 新增页面：`packages/miniprogram/miniprogram/pages/agent/withdraw`
- 新增服务：`saveAgentBankCard`，已切到云函数
- 提现页支持展示可提现、累计佣金、已提现、银行卡、提现金额输入、提现记录
- 提交提现复用现有 `requestWithdrawal` 服务入口，底层已切到云函数写入 `withdrawals` 并扣减 `users.commission.available`
- 提成中心“申请提现”已跳转到资金页
- 首页/我的页已增加提现管理入口

已验证：

- `npm run typecheck -w packages/miniprogram`
- `packages/miniprogram/miniprogram/app.json` JSON 解析通过

下一步建议：

**P0-5：新增代理商订单列表/代理商订单视角。**

执行状态：代理商订单列表/订单视角已完成第一版。

已落地：

- 新增页面：`packages/miniprogram/miniprogram/pages/agent/orders`
- 新增服务：`getAgentOrders`
- 代理商订单页按当前代理商 `salespersonId` 查询订单，并展示客户、客户类型、订单金额、订单状态、预计提成、售后状态
- 客户详情页“客户订单”已跳转到代理商订单页并传入 `customerId`
- 首页/我的页已增加客户订单入口

已验证：

- `npm run typecheck -w packages/miniprogram`
- `packages/miniprogram/miniprogram/app.json` JSON 解析通过

下一步建议：

**P0-6：下沉 `updateOrderStatusWithLog` / 后台订单状态流转。**

执行状态：订单状态流转云函数化基础版已完成并部署到项目级 CloudBase 环境。

已落地：

- 新增云函数：`packages/miniprogram/cloudfunctions/updateOrderStatus`
- 小程序服务层：`updateOrderStatus(orderId, status)`、`updateOrderStatusWithLog(orderId, status, operator?)` 已切到 `wx.cloud.callFunction`
- 订单详情页：取消订单、确认收货已补云函数错误提示
- 客户校验：订单本人可从待支付取消订单、从待收货确认收货
- 后台角色校验：`admin`、`system_admin`、`service` 可按状态机执行确认、服务中、完成、取消等流转
- 云函数写入：`orders.status`、`updatedAt`，订单完成时将待结算提成置为锁定状态
- 操作日志：写入 `logs` 集合，记录操作人、动作、目标订单和状态变更
- 云端状态：函数运行时 `Nodejs18.15`，状态 `Active / Available`

已验证：

- `npm run typecheck -w packages/miniprogram`
- `node --check packages/miniprogram/cloudfunctions/updateOrderStatus/index.js`

下一步建议：

**P0-7：代理商申请/提现写操作云函数化。**

执行状态：代理商申请、银行卡保存、提现申请云函数化基础版已完成并部署到项目级 CloudBase 环境。

已落地：

- 新增云函数：`packages/miniprogram/cloudfunctions/submitAgentApplication`
- 新增云函数：`packages/miniprogram/cloudfunctions/saveAgentBankCard`
- 新增云函数：`packages/miniprogram/cloudfunctions/requestWithdrawal`
- 小程序服务层：`submitAgentApplication(userId, info)`、`saveAgentBankCard(userId, card)`、`requestWithdrawal(salespersonId, amount, bankCardId)` 已切到 `wx.cloud.callFunction`
- 代理商申请校验：登录 openid、用户归属、角色可申请、已通过不可重复申请、基础表单字段
- 银行卡校验：登录 openid、用户归属、银行名称、持卡人、银行卡号格式
- 提现校验：登录 openid、代理商资格、最低提现金额、可提现余额、银行卡存在
- 云函数写入：`users.agentStatus/agentApplication`、`users.bankCards`、`withdrawals`、`users.commission.available/withdrawn`；提现扣款使用余额条件更新，避免并发扣成负数
- 操作日志：写入 `logs` 集合，记录代理商申请、保存银行卡、提交提现
- 云端状态：三个函数已通过项目级 CloudBase MCP 创建部署

已验证：

- `npm run typecheck -w packages/miniprogram`
- `node --check packages/miniprogram/cloudfunctions/submitAgentApplication/index.js`
- `node --check packages/miniprogram/cloudfunctions/saveAgentBankCard/index.js`
- `node --check packages/miniprogram/cloudfunctions/requestWithdrawal/index.js`

下一步建议：

**P0-8：补售后审核状态流转云函数。**

执行状态：售后审核和售后状态流转云函数化基础版已完成并部署到项目级 CloudBase 环境。

已落地：

- 新增云函数：`packages/miniprogram/cloudfunctions/reviewReturn`
- 小程序服务层：`reviewReturn(id, approved, reviewerId, note)` 已切到 `wx.cloud.callFunction`
- 小程序服务层：新增 `updateReturnStatus(id, status, operator?)`，复用 `reviewReturn` 云函数推进售后节点
- 云函数校验：登录 openid、客服/管理员角色、售后记录存在、当前状态是否允许流转
- 状态机支持：待审核 -> 审核通过/驳回；审核通过 -> 等待寄回/退款中；等待寄回 -> 商品质检；商品质检 -> 退款中/驳回/换货发货；退款中 -> 售后完成；换货发货 -> 换货完成
- 云函数写入：`returns.status`、`reviewerId`、`reviewNote`、`reviewedAt`、`verificationResult`、`timeline`、`updatedAt`
- 操作日志：写入 `logs` 集合，记录客服/管理员的售后状态变更
- 云端状态：函数已通过项目级 CloudBase MCP 创建部署

已验证：

- `npm run typecheck -w packages/miniprogram`
- `node --check packages/miniprogram/cloudfunctions/reviewReturn/index.js`

下一步建议：

**P0-9：补提现审核/驳回退回余额/打款确认云函数。**

执行状态：提现审核状态流转云函数化基础版已完成并部署到项目级 CloudBase 环境。

已落地：

- 新增云函数：`packages/miniprogram/cloudfunctions/reviewWithdrawal`
- 小程序服务层：新增 `reviewWithdrawal(id, approved, reviewerId, note?)`
- 小程序服务层：新增 `updateWithdrawalStatus(id, status, operator?, note?)`
- 云函数校验：登录 openid、财务/管理员/具备提现权限的客服角色、提现记录存在、当前状态是否允许流转
- 状态机支持：`pending_review -> approved/rejected`，`approved -> paid`；兼容旧 `completed` 入参为 `paid`
- 驳回处理：将提现金额退回 `users.commission.available`，并从 `users.commission.withdrawn` 扣回，避免资金一直冻结在已提现
- 打款处理：写入 `completedAt`，将提现记录状态置为 `paid`
- 操作日志：写入 `logs` 集合，记录审核通过、驳回、打款确认
- 云端状态：函数已通过项目级 CloudBase MCP 创建部署

已验证：

- `npm run typecheck -w packages/miniprogram`
- `node --check packages/miniprogram/cloudfunctions/reviewWithdrawal/index.js`

下一步建议：

**P0-10：补开票后台云函数。**

执行状态：开票后台处理云函数化基础版已完成并部署到项目级 CloudBase 环境。

已落地：

- 新增云函数：`packages/miniprogram/cloudfunctions/processInvoice`
- 小程序服务层：新增 `processInvoice(params)`，供后续后台/客服页面复用
- 云函数校验：登录 openid、财务/管理员/具备开票权限的客服角色、发票记录存在、当前状态是否为待处理
- 状态支持：`pending -> issued/rejected`；兼容 `invoiced/approved` 入参为 `issued`
- 电子发票校验：开票通过时必须提供 `invoiceFileID` 或 `fileID`
- 纸质发票支持：可写入 `company/trackingNo/shippedAt` 邮寄物流信息
- 云函数写入：`invoices.status`、`invoiceNo`、`invoiceFileID`、`shipping`、`processorId`、`processNote`、`processedAt`、`issuedAt/rejectReason`
- 订单回写：写入 `orders.invoice` 摘要，包含发票状态、发票号、文件、驳回原因和更新时间
- 操作日志：写入 `logs` 集合，记录开票通过或驳回
- 云端状态：函数已通过项目级 CloudBase MCP 创建部署

已验证：

- `npm run typecheck -w packages/miniprogram`
- `node --check packages/miniprogram/cloudfunctions/processInvoice/index.js`

下一步建议：

**P0-11：补医院认证审核通过/驳回云函数。**

执行状态：医院认证审核云函数化基础版已完成并部署到项目级 CloudBase 环境。

已落地：

- 新增云函数：`packages/miniprogram/cloudfunctions/reviewVerification`
- 小程序服务层：新增 `reviewVerification(userId, approved, rejectReason?, operator?)`
- 云函数校验：登录 openid、客服/管理员角色、目标用户存在、仅客户角色可审核、当前状态必须为待审核、认证材料存在
- 审核通过：写入 `verificationStatus = approved`，并同步 `customerType = institution`，让血包购买权限闭环生效
- 审核驳回：写入 `verificationStatus = rejected`，并写入 `verificationInfo.rejectReason`
- 审核痕迹：写入 `verificationInfo.reviewedAt/reviewerId/reviewerName`
- 操作日志：写入 `logs` 集合，记录医院认证通过或驳回
- 云端状态：函数已通过项目级 CloudBase MCP 创建部署

已验证：

- `npm run typecheck -w packages/miniprogram`
- `node --check packages/miniprogram/cloudfunctions/reviewVerification/index.js`

下一步建议：

**P0-12：补代理商申请审核通过/驳回云函数。**

执行状态：代理商申请审核云函数化基础版已完成并部署到项目级 CloudBase 环境。

已落地：

- 新增云函数：`packages/miniprogram/cloudfunctions/reviewAgentApplication`
- 小程序服务层：新增 `reviewAgentApplication(userId, approved, rejectReason?, operator?)`
- 云函数校验：登录 openid、客服/管理员角色、目标用户存在、当前存在待审核代理商申请
- 审核通过：写入 `agentStatus = approved`，将用户角色切到 `salesperson`，初始化 `commission`、`bankCards`、`customers`，写入 `agentApprovedAt`
- 审核驳回：写入 `agentStatus = rejected` 和 `agentApplication.rejectReason`
- 审核痕迹：写入 `agentApplication.reviewedAt/reviewerId/reviewerName`
- 操作日志：写入 `logs` 集合，记录代理商审核通过或驳回
- 云端状态：函数已通过项目级 CloudBase MCP 创建部署

已验证：

- `npm run typecheck -w packages/miniprogram`
- `node --check packages/miniprogram/cloudfunctions/reviewAgentApplication/index.js`

下一步建议：

**P0-13：回到后台 UI，把医院认证、代理商审核页面接 CloudBase 云函数。**

执行状态：后台用户审核页已完成第一版 CloudBase 接入。

已落地：

- 新增服务端 MCP 代理：`packages/admin/src/lib/cloudbase-mcp.ts`
- 新增后台 API：`packages/admin/src/app/api/cloudbase/users/route.ts`
- 新增后台 API：`packages/admin/src/app/api/cloudbase/users/review/route.ts`
- 后台用户页：`packages/admin/src/app/(admin)/users/page.tsx` 优先读取 CloudBase `users` 集合，失败时回退本地 mock
- 后台用户页：新增“代理审核”tab，展示 `agentStatus = pending_review` 的代理商申请
- 后台用户页：医院认证审核调用 `reviewVerification` 云函数
- 后台用户页：代理商申请审核调用 `reviewAgentApplication` 云函数
- 云函数兼容：`reviewVerification`、`reviewAgentApplication` 已补服务端调用分支；无小程序 `OPENID` 时必须传后台操作人 ID，并由云函数校验其管理员/客服权限

已验证：

- `npm run typecheck -w packages/miniprogram`
- `node --check packages/miniprogram/cloudfunctions/reviewVerification/index.js`
- `node --check packages/miniprogram/cloudfunctions/reviewAgentApplication/index.js`
- `npx eslint 'src/app/(admin)/users/page.tsx' src/lib/cloudbase-mcp.ts src/app/api/cloudbase/users/route.ts src/app/api/cloudbase/users/review/route.ts`
- `GET http://localhost:3011/api/cloudbase/users` 返回 CloudBase 用户数据：客户 6、代理商 2、待审核代理申请 0
- `GET http://localhost:3011/users` 返回 200

已知限制：

- 后台全量 `tsc` 仍被既有 `packages/admin/src/app/(admin)/products/page.tsx` 的 `category: string | null` 类型问题阻塞，和本轮用户审核接入无关。

下一步建议：

**P0-14：继续把提现审核页、开票处理页接入 CloudBase 云函数。**

执行状态：后台财务处理页已完成第一版 CloudBase 接入。

已落地：

- 新增后台 API：`packages/admin/src/app/api/cloudbase/finance/route.ts`
- 新增后台页面：`packages/admin/src/app/(admin)/finance/page.tsx`
- 后台侧边栏：新增“财务处理”入口
- 财务页面：新增“提现审核”tab，读取 CloudBase `withdrawals` 集合
- 财务页面：提现审核调用 `reviewWithdrawal` 云函数，支持通过、驳回、确认打款
- 财务页面：新增“开票处理”tab，读取 CloudBase `invoices` 集合
- 财务页面：开票处理调用 `processInvoice` 云函数，支持开票、驳回、电子发票文件、纸票物流

已验证：

- `npm run typecheck -w packages/miniprogram`
- `npx eslint 'src/app/(admin)/finance/page.tsx' src/app/api/cloudbase/finance/route.ts src/components/admin/app-sidebar.tsx`
- `GET http://localhost:3011/api/cloudbase/finance` 返回 CloudBase 财务数据：提现 0、发票 0
- `GET http://localhost:3011/finance` 返回 200

下一步建议：

**P0-15：修复后台 products 页既有类型错误，恢复全量 admin typecheck；然后继续把退换货页、订单页逐步接 CloudBase。**

执行状态：后台 products 页既有类型错误已修复，后台退换货页已完成第一版 CloudBase 接入。

已落地：

- `packages/admin/src/app/(admin)/products/page.tsx`：为分类筛选、分页下拉、编辑/新建分类下拉补 `null` 兜底，恢复全量 admin typecheck。
- 新增后台 API：`packages/admin/src/app/api/cloudbase/returns/route.ts`
- 后台退换货页：`packages/admin/src/app/(admin)/returns/page.tsx` 改为读取 CloudBase `returns` 集合。
- 后台退换货页：售后审核、等待寄回、确认收货验货、验货合格/不合格、确认退款、换货发货、换货完成均通过后台 API 代理调用 `reviewReturn` 云函数。
- 状态兼容：后台已兼容旧状态 `pending_return_ship/returned/verifying` 和云函数新状态 `customer_shipping/received`。
- 云函数兼容：`reviewReturn` 已补服务端调用分支；无小程序 `OPENID` 时必须传后台操作人 ID，并由云函数校验其客服/管理员售后权限。
- 云端状态：`reviewReturn` 已通过项目 `.mcp.json` 直连 `cloudbase-d4gwpsm7gcc59b6fc` 更新函数代码。

已验证：

- `npm run typecheck -w packages/miniprogram`
- `npx tsc -p packages/admin/tsconfig.json --noEmit`
- `npx eslint 'src/app/(admin)/products/page.tsx'`
- `npx eslint 'src/app/(admin)/returns/page.tsx' src/app/api/cloudbase/returns/route.ts`
- `node --check packages/miniprogram/cloudfunctions/reviewReturn/index.js`
- `GET http://localhost:3011/api/cloudbase/returns` 返回 CloudBase 售后数据：3 条
- `GET http://localhost:3011/products` 返回 200
- `GET http://localhost:3011/returns` 返回 200

已知限制：

- `products` 页 lint 仍有既有 `<img>` 性能 warning，但不影响类型检查和本轮接入。
- 退换货后台操作已接云函数，尚未做真实记录的破坏性状态流转测试，避免改动当前云端业务数据。

下一步建议：

**P0-16：继续把后台订单管理页接入 CloudBase，优先处理订单列表/详情读取、改价、发货、取消/确认等动作。**

执行状态：后台订单管理页已完成第一版 CloudBase 接入。

已落地：

- 新增后台 API：`packages/admin/src/app/api/cloudbase/orders/route.ts`
- 后台订单列表页：`packages/admin/src/app/(admin)/orders/page.tsx` 改为读取 CloudBase `orders` 集合。
- 后台订单详情页：`packages/admin/src/app/(admin)/orders/[id]/page.tsx` 改为按订单 ID 读取 CloudBase 订单详情。
- 订单改价：后台调用 `adjustOrderPrice` 云函数。
- 订单状态推进：后台调用 `updateOrderStatus` 云函数，支持取消、预约确认、开始服务、完成服务等状态流转。
- 订单发货：后台调用 `clerkShipOrder` 云函数，录入物流公司和物流单号。
- 云函数兼容：`adjustOrderPrice`、`updateOrderStatus`、`clerkShipOrder` 已补服务端调用分支；无小程序 `OPENID` 时必须传后台操作人 ID，并由云函数校验管理员/客服/制单员权限。
- 云端状态：`adjustOrderPrice`、`updateOrderStatus`、`clerkShipOrder` 已通过项目 `.mcp.json` 直连 `cloudbase-d4gwpsm7gcc59b6fc` 更新函数代码。

已验证：

- `npm run typecheck -w packages/miniprogram`
- `npx tsc -p packages/admin/tsconfig.json --noEmit`
- `npx eslint 'src/app/(admin)/orders/page.tsx' 'src/app/(admin)/orders/[id]/page.tsx' src/app/api/cloudbase/orders/route.ts`
- `node --check packages/miniprogram/cloudfunctions/adjustOrderPrice/index.js`
- `node --check packages/miniprogram/cloudfunctions/updateOrderStatus/index.js`
- `node --check packages/miniprogram/cloudfunctions/clerkShipOrder/index.js`
- `GET http://localhost:3011/api/cloudbase/orders` 返回 CloudBase 订单数据：10 条
- `GET http://localhost:3011/api/cloudbase/orders?id=ord_006` 返回订单详情：状态 `pending_payment`
- `GET http://localhost:3011/orders` 返回 200
- `GET http://localhost:3011/orders/ord_006` 返回 200

已知限制：

- 后台订单页已支持真实改价、状态流转和发货，但本轮未对真实云端订单执行写操作测试，避免改动当前业务数据。
- 原“指派制单员”是本地 mock 行为，当前第一版后台云端接入改为直接录入物流发货；如客户仍需要后台分配制单员，需要下一步补 `assignOrderToClerk` 云函数和对应制单员队列集合。

下一步建议：

**P0-17：补后台 dashboard/日志/系统配置的 CloudBase 读取，或先补 `assignOrderToClerk` 云函数，取决于客户是否强调制单员分配流程。**

执行状态：已优先补齐 `assignOrderToClerk` 云函数和后台指派制单员闭环。

已落地：

- 新增云函数：`packages/miniprogram/cloudfunctions/assignOrderToClerk`
- 后台订单 API：`packages/admin/src/app/api/cloudbase/orders/route.ts` 已返回 CloudBase 制单员列表，并新增 `assign` 动作代理调用 `assignOrderToClerk` 云函数。
- 后台订单列表页：`packages/admin/src/app/(admin)/orders/page.tsx` 恢复“指派制单员”弹窗。
- 后台订单列表页：未指派订单先显示“指派”，已指派订单显示“发货”；发货继续调用 `clerkShipOrder`。
- 指派云函数校验：后台操作人权限、订单存在、订单状态为 `pending_shipment/confirmed`、目标用户为 `clerk`。
- 指派云函数写入：`orders.clerkId`、`orders.assignedAt`、`orders.updatedAt`，并为制单员用户追加 `assignedOrderIds`。
- 操作日志：写入 `logs` 集合，记录订单指派制单员。
- 云端状态：`assignOrderToClerk` 已通过项目 `.mcp.json` 直连 `cloudbase-d4gwpsm7gcc59b6fc` 创建部署。

已验证：

- `npm run typecheck -w packages/miniprogram`
- `npx tsc -p packages/admin/tsconfig.json --noEmit`
- `npx eslint 'src/app/(admin)/orders/page.tsx' src/app/api/cloudbase/orders/route.ts`
- `node --check packages/miniprogram/cloudfunctions/assignOrderToClerk/index.js`
- `GET http://localhost:3011/api/cloudbase/orders` 返回 CloudBase 订单 10 条、制单员 2 个
- `GET http://localhost:3011/orders` 返回 200
- `GET http://localhost:3011/orders/ord_006` 返回 200

已知限制：

- 本轮没有对真实订单执行指派写操作测试，避免改动当前云端业务数据。

下一步建议：

**P0-18：补后台 dashboard、日志、系统配置的 CloudBase 读取，让后台首页统计和审计页面也脱离 mock。**

执行状态：后台 dashboard、日志、系统配置已完成第一版 CloudBase 接入。

已落地：

- 新增后台 API：`packages/admin/src/app/api/cloudbase/dashboard/route.ts`
- 新增后台 API：`packages/admin/src/app/api/cloudbase/logs/route.ts`
- 新增后台 API：`packages/admin/src/app/api/cloudbase/system/route.ts`
- 后台仪表盘：`packages/admin/src/app/(admin)/dashboard/page.tsx` 改为读取 CloudBase `orders/products/returns/users/config` 聚合数据。
- 后台日志页：`packages/admin/src/app/(admin)/logs/page.tsx` 改为读取 CloudBase `logs` 集合。
- 后台系统配置页：`packages/admin/src/app/(admin)/system/page.tsx` 改为读取 CloudBase `config/system`，保存时写回 CloudBase。
- 配置兜底：若云端暂无 `config/system`，后台 API 返回 `defaultSystemConfig`；保存时会创建 `_id = system` 的配置文档。

已验证：

- `npx tsc -p packages/admin/tsconfig.json --noEmit`
- `npx eslint 'src/app/(admin)/dashboard/page.tsx' 'src/app/(admin)/logs/page.tsx' 'src/app/(admin)/system/page.tsx' src/app/api/cloudbase/dashboard/route.ts src/app/api/cloudbase/logs/route.ts src/app/api/cloudbase/system/route.ts`
- `GET http://localhost:3011/api/cloudbase/dashboard` 返回 CloudBase 数据：订单 10、商品 21、售后 3、客户 6、配置存在
- `GET http://localhost:3011/api/cloudbase/logs` 返回 CloudBase 日志 10 条
- `GET http://localhost:3011/api/cloudbase/system` 返回系统配置，库存预警阈值 10
- `GET http://localhost:3011/dashboard` 返回 200
- `GET http://localhost:3011/logs` 返回 200
- `GET http://localhost:3011/system` 返回 200

已知限制：

- 本轮只验证系统配置读取，没有执行保存写操作测试，避免误改当前云端配置。

下一步建议：

**P0-19：清理后台剩余 mock 页面（商品管理、账号/角色等），并对后台 CloudBase API 做权限守卫和错误态统一。**

执行状态：后台商品管理已完成第一版 CloudBase 接入，并完成真实测试数据写操作验证。

已落地：

- 新增后台 API：`packages/admin/src/app/api/cloudbase/products/route.ts`
- 后台商品页：`packages/admin/src/app/(admin)/products/page.tsx` 改为读取 CloudBase `products/categories` 集合。
- 商品创建：后台 API 写入 CloudBase `products` 集合，并写入 `logs` 操作日志。
- 商品编辑：后台 API 使用 `$set` 更新 CloudBase `products`，避免整文档替换。
- 商品上下架/批量下架：后台 API 写入 CloudBase，并记录上下架日志。
- 页面状态：商品页补加载态和错误态。

已验证：

- `npx tsc -p packages/admin/tsconfig.json --noEmit`
- `npx eslint 'src/app/(admin)/products/page.tsx' src/app/api/cloudbase/products/route.ts`：0 error，仍有既有 `<img>` warning
- `POST http://localhost:3011/api/cloudbase/products` 创建测试商品 `codex_test_mov0lic7`
- `PATCH http://localhost:3011/api/cloudbase/products` 将测试商品库存改为 3，并下架
- `GET http://localhost:3011/api/cloudbase/products` 回读成功：商品总数 22，测试商品 `stock = 3`、`status = off_sale`
- `GET http://localhost:3011/api/cloudbase/logs` 回读到 2 条测试商品操作日志
- `GET http://localhost:3011/products` 返回 200

下一步建议：

**P0-20：补后台 CloudBase API 统一权限守卫，然后再处理账号/角色页面是否保留 mock 或改为真实用户/权限配置。**

执行状态：后台 CloudBase API 统一权限守卫已完成第一版。

已落地：

- 新增前端请求 helper：`packages/admin/src/lib/admin-api-client.ts`
- 新增服务端权限 helper：`packages/admin/src/lib/admin-api-auth.ts`
- 前端 CloudBase 请求统一携带当前后台用户最小身份头，不再由各页面裸调 `/api/cloudbase/*`。
- 服务端 CloudBase API 统一校验后台登录状态、账号启用状态、角色和权限。
- 已纳入守卫的 API：
  - `dashboard`：仅 `system_admin`
  - `logs`：仅 `system_admin`
  - `system`：仅 `system_admin`
  - `users` / `users/review`：仅 `system_admin`
  - `products`：`product_manager` / `system_admin`
  - `orders`：`service` / `system_admin` 或具备 `manage_orders`
  - `returns`：`service` / `system_admin` 或具备 `manage_returns`
  - `finance`：`service` / `system_admin`
- 已更新相关页面请求：商品、订单、订单详情、售后、财务、用户、仪表盘、日志、系统配置。

已验证：

- `npx tsc -p packages/admin/tsconfig.json --noEmit`
- `npx eslint src/lib/admin-api-auth.ts src/lib/admin-api-client.ts src/app/api/cloudbase/...`
- 无身份头访问 `GET /api/cloudbase/products` 返回 401
- 商品管理员访问 `GET /api/cloudbase/products` 返回 200，商品 22 条
- 商品管理员访问 `GET /api/cloudbase/orders` 返回 403
- 系统管理员访问 `GET /api/cloudbase/dashboard` 返回 200，订单 10、商品 22

已知限制：

- 本段记录的是 P0-20 第一版守卫状态；后续 P0-23 已升级为 HTTP-only session/token，并在服务端查库校验，详见本文“后台 P0-22 至 P0-28 收口记录”。

下一步建议：

**P0-21：处理账号/角色页面：要么明确标注为本地后台账号模拟配置，要么接 CloudBase `users/roles` 真实权限模型。**

执行状态：后台账号/角色页面已接入 CloudBase `users` 真实权限模型。

已落地：

- 新增后台账号 API：`packages/admin/src/app/api/cloudbase/accounts/route.ts`
- 新增后台登录 API：`packages/admin/src/app/api/cloudbase/accounts/login/route.ts`
- 新增后台角色 API：`packages/admin/src/app/api/cloudbase/roles/route.ts`
- 登录页：`packages/admin/src/app/(auth)/login/page.tsx` 改为读取 CloudBase 后台账号。
- 账号页：`packages/admin/src/app/(admin)/accounts/page.tsx` 改为 CloudBase 后台账号 CRUD。
- 角色页：`packages/admin/src/app/(admin)/roles/page.tsx` 改为读取/保存 CloudBase 后台角色权限。
- 后台账号模型：复用 CloudBase `users` 集合，后台账号为 `role = service/product_manager/system_admin` 的用户。
- 角色权限模型：按角色批量更新 `users.permissions`。
- 开发阶段初始化：当云端缺少默认后台账号时，登录 API 会补齐 `service/product_manager/system_admin` 三个测试账号。

已验证：

- `npx tsc -p packages/admin/tsconfig.json --noEmit`
- `npx eslint 'src/app/(auth)/login/page.tsx' 'src/app/(admin)/accounts/page.tsx' 'src/app/(admin)/roles/page.tsx' src/app/api/cloudbase/accounts/route.ts src/app/api/cloudbase/accounts/login/route.ts src/app/api/cloudbase/roles/route.ts`
- `POST /api/cloudbase/accounts/login` 使用 `system_admin` 登录成功，返回 `admin_003/system_admin`
- `GET /api/cloudbase/accounts` 返回默认后台账号 3 个：`service/product_manager/system_admin`
- `GET /api/cloudbase/roles` 返回三个角色人数均为 1
- 真实写验证：创建测试后台账号 `codex_admin_test_mov14vpa`
- 真实写验证：禁用该测试后台账号成功
- 真实写验证：删除该测试后台账号成功
- `GET http://localhost:3011/accounts` 返回 200
- `GET http://localhost:3011/roles` 返回 200

下一步建议：

**P0-22：做一轮后台端到端冒烟：从登录开始，按 system_admin/product_manager/service 三个角色分别进入后台，验证侧边栏、权限守卫、核心页面读写链路。**

执行状态：已完成，并继续完成 P0-23 至 P0-28 的后台安全、审计和真实业务写链路收口。

## 8. 后台 P0-22 至 P0-28 收口记录

### P0-22：后台端到端冒烟

执行状态：已完成。

已落地：

- 修复后台 CloudBase API 角色守卫：仅配置 `roles` 的接口不再因为缺少 `permissions` 而误放行。
- 新增后台页面级角色守卫：`packages/admin/src/app/(admin)/layout.tsx` 会按当前后台账号过滤侧边栏和拦截无权页面。
- 按 `system_admin/product_manager/service` 三个角色分别从登录开始验证后台入口、侧边栏、接口权限和核心页面可访问性。

已验证：

- `system_admin` 可访问仪表盘、日志、系统、账号、角色和全部业务页面。
- `product_manager` 可访问商品相关页面，访问订单/日志等非授权接口会被拒绝。
- `service` 可访问订单、售后、财务、用户审核等客服运营链路。
- `/accounts`、`/roles`、`/logs` 等关键页面返回 200，未授权 API 返回 401/403。

### P0-23：后台会话鉴权升级

执行状态：已完成。

已落地：

- 后台登录从前端 `localStorage admin_user` 透传身份头升级为服务端签名的 HTTP-only `admin_session` cookie。
- 新增会话 API：`packages/admin/src/app/api/cloudbase/accounts/session/route.ts`。
- `packages/admin/src/lib/admin-api-auth.ts` 负责签发、校验、清除会话，并在每次请求中回读 CloudBase `users`，确保禁用账号的旧 cookie 立即失效。
- `packages/admin/src/lib/admin-api-client.ts` 改为 `credentials: 'same-origin'`，不再拼装可伪造的后台身份头。
- 侧边栏退出登录会清除服务端 cookie 和本地展示态。

已验证：

- 无 cookie 访问后台 CloudBase API 返回 401。
- 伪造 `x-admin-user` 身份头访问后台 CloudBase API 返回 401。
- 登录、读取 session、进入 dashboard、退出登录链路通过。
- 禁用临时后台账号后，该账号已有 cookie 立即失效。

### P0-24：后台操作日志闭环

执行状态：已完成。

已落地：

- 新增统一日志 helper：`packages/admin/src/lib/admin-log.ts`。
- 后台关键写操作统一写入 CloudBase `logs` 集合，字段包含操作人、角色、动作、对象、结果、时间和详情。
- 已覆盖：账号创建/更新/禁用/启用/删除、角色权限保存、商品创建/更新/上下架、订单动作、售后审核、提现审核、开票处理、系统配置保存、用户/代理审核。
- 日志 API 统一兼容 `OperationLog` 展示模型。
- 日志页新增详情弹窗和更完整筛选。

已验证：

- 真实创建/禁用/删除测试账号时可在日志页回读对应记录。
- 商品上下架、订单/售后/财务等写操作均能产生可筛选日志。
- 浏览器中日志详情弹窗可正常打开。

### P0-25：后台真实业务写链路一致性

执行状态：已完成。

已落地：

- 新增 CloudBase 云函数返回值解析 helper：`packages/admin/src/lib/cloudbase-function-result.ts`，兼容 MCP `invokeFunction` 的 `invokeResult.RetMsg` 和嵌套返回结构。
- 后台 `orders/returns/finance/users/review` API 会在调用云函数时自动注入当前后台操作人，避免依赖小程序 `OPENID`。
- 重部署并验证后台依赖的远端云函数：
  - `updateOrderStatus`
  - `reviewReturn`
  - `reviewWithdrawal`
  - `processInvoice`
  - `reviewVerification`
  - `reviewAgentApplication`
  - `assignOrderToClerk`
  - `clerkShipOrder`
  - `adjustOrderPrice`
- 补丁并重部署：
  - `packages/miniprogram/cloudfunctions/reviewWithdrawal/index.js`
  - `packages/miniprogram/cloudfunctions/processInvoice/index.js`
- 创建临时 CloudBase 订单、售后、发票、提现、商品数据做真实写冒烟，并在验证后清理。

已验证：

- 订单：`pending_confirmation -> confirmed -> in_service` 链路通过。
- 售后：`pending_review -> approved` 链路通过。
- 发票：`pending -> rejected` 链路通过。
- 提现：`pending_review -> approved` 链路通过。
- 商品：真实创建测试商品，上下架后回读状态正确，最后删除测试商品。
- 临时订单、售后、发票、提现、商品文档已清理，按精确 ID 回查不存在。

### P0-26：会话过期前端体验

执行状态：已完成。

已落地：

- `packages/admin/src/lib/admin-api-client.ts` 在收到 401 时会清除本地 `admin_user` 展示态并跳转 `/login`。
- 避免 session 过期后页面停留在半登录状态。

### P0-27：小程序与后台核心链路联动冒烟

执行状态：已完成第一轮。

已验证：

- 小程序侧核心集合产生的数据可由后台读取、审核和推进。
- 后台订单、售后、发票、提现、商品写操作会真实落 CloudBase 集合。
- 后台 API 调用云函数时使用当前后台操作人，不依赖浏览器伪造身份。

### P0-28：生产安全收口

执行状态：已完成第一轮。

已落地：

- `ADMIN_SESSION_SECRET` 在生产环境中为必填；缺失时不允许使用开发 fallback。
- 后台登录的“任意密码通过”仅限非生产或显式设置 `ADMIN_ALLOW_ANY_PASSWORD=true` 的开发场景。
- 生产环境不会接受默认种子账号的占位密码 `hashed_password_*` 作为真实密码。
- `packages/admin/README.md` 已补后台环境变量说明。
- 已检查 `packages/miniprogram/cloudbase/database-security-rules.json` 和安全基线文档；本轮未直接发布旧核心集合安全规则，避免在仍有前端直读/直写兼容路径时误伤现有链路。

已验证：

- `npm run lint -w packages/admin`：通过，仍有商品页既有 `<img>` warning。
- `npx tsc --noEmit -p packages/admin/tsconfig.json`：通过。
- `npm run build -w packages/admin`：通过。
- 后台 API 角色矩阵通过。

## 9. 当前项目位置

P0 阶段已经从“小程序 UI 和基础业务接入”推进到“后台真实 CloudBase 管理闭环”：

- 小程序客户、代理商、制单员主要 P0 页面和关键云函数已完成基础版。
- 后台商品、订单、售后、财务、用户审核、仪表盘、日志、系统、账号、角色已脱离 mock，接入 CloudBase 真实数据。
- 后台鉴权已从开发身份头升级为 HTTP-only session。
- 后台关键写操作有审计日志。
- 核心业务写链路已完成真实 CloudBase 冒烟。

仍需注意：

- CloudBase 全局 MCP 可能仍指向测试环境；项目操作应继续使用项目 `.mcp.json` 绑定的 `cloudbase-d4gwpsm7gcc59b6fc`。
- `orders/users/returns` 等旧核心集合的安全规则尚未正式远端发布，需要先做分阶段规则上线方案。
- 后台默认账号适合开发和验收；生产前需要初始化真实密码或补密码重置/邀请流程。
- 商品页仍有 Next.js `<img>` lint warning，可后续统一替换为 `next/image` 或配置图片域名策略。

下一步建议：

**P1-1：上线前安全与运维收口。**

建议范围：

- 分阶段发布 CloudBase 核心集合安全规则，先读规则、再写规则，逐步迁移掉前端直写路径。
- 补后台真实密码初始化/重置流程，移除生产环境默认占位密码风险。
- 整理后台操作日志为可审计视图：失败日志、操作者筛选、目标对象跳转。
- 处理商品页 `<img>` warning 和生产图片策略。
- 再进入 P1 业务补齐：通知中心、优惠券/活动、报表、提成结算、报告维护、代理商/制单员体验增强。
