# CloudBase 集合、索引与安全规则基线

> 日期：2026-05-07  
> 适用环境：`cloudbase-d4gwpsm7gcc59b6fc`  
> 背景：小程序端已完成医院认证、地址、支付结果、售后、发票、物流、检测报告的 CloudBase 真实读写接入。下一步需要收口云数据库集合、索引与安全边界。

## 1. 当前约束

- 当前会话中已挂载的全局 `mcp__cloudbase__` 工具会自动绑定到测试环境 `clo-test-4g8ukdond34672de`，不能直接作为本项目云端操作基准。
- 项目级 `.mcp.json` 与小程序 `app.ts` 均指向 `cloudbase-d4gwpsm7gcc59b6fc`。
- 2026-05-07 已按项目 `.mcp.json` 直接启动 CloudBase MCP 子进程，确认当前环境为 `cloudbase-d4gwpsm7gcc59b6fc`。
- 已知项目级环境此前返回集合：`categories`、`commission_records`、`config`、`logs`、`notifications`、`orders`、`products`、`returns`、`users`、`withdrawals`。
- 本轮新增业务依赖集合：`invoices`、`test_reports`。这两个集合已在项目级环境创建，并已添加基础索引和最小安全规则。
- 订单、售后、发票等文档当前使用 `customerId = users._id` 表达业务归属；CloudBase 数据库安全规则天然可用的是 `auth.openid` / `auth.uid` 与文档字段，无法安全地跨集合查询用户文档。因此，强业务校验应逐步下沉云函数。

## 2. 集合清单

| 集合 | 当前用途 | 状态 |
| --- | --- | --- |
| `users` | 用户、角色、认证申请、地址、钱包、提成信息 | 已存在，需收紧规则 |
| `orders` | 订单、支付、物流、提成、售后关联 | 已存在，建议补归属字段 |
| `returns` | 售后申请、凭证、进度、退款金额 | 已存在，需收紧规则 |
| `invoices` | 发票申请 | 已创建，已配置索引和安全规则 |
| `test_reports` | 血包检测报告查询 | 已创建，已配置索引和安全规则 |
| `products` | 商品与血包商品信息 | 已存在，读规则需保留 |
| `categories` | 商品分类 | 已存在，读规则需保留 |
| `logs` | 订单改价、审核等操作日志 | 已存在，应后台写 |
| `notifications` | 用户通知 | 已存在，需按用户限制 |
| `commission_records` | 代理/销售提成记录 | 已存在，需按销售限制 |
| `withdrawals` | 提现申请 | 已存在，需按销售限制 |

## 3. 建议索引

### 3.1 `users`

- `phone_role`: `phone ASC`, `role ASC`
- `openid`: `_openid ASC`
- `role_status`: `role ASC`, `status ASC`
- `bound_salesperson`: `boundSalespersonId ASC`
- `verification_status`: `verificationStatus ASC`, `updatedAt DESC`

### 3.2 `orders`

- `customer_created`: `customerId ASC`, `createdAt DESC`
- `salesperson_created`: `salespersonId ASC`, `createdAt DESC`
- `clerk_status_created`: `clerkId ASC`, `status ASC`, `createdAt DESC`
- `status_created`: `status ASC`, `createdAt DESC`
- `order_no`: `orderNo ASC`
- `return_record`: `returnRecordId ASC`

建议后续补字段：

- `customerOpenid`: 下单客户的 `_openid`，用于数据库规则直接限制读取。
- `clerkOpenid`: 制单员的 `_openid`，用于制单员读取/发货限制。
- `salespersonOpenid`: 代理/销售的 `_openid`，用于代理汇总读取。

### 3.3 `returns`

- `order_created`: `orderId ASC`, `createdAt DESC`
- `customer_created`: `customerId ASC`, `createdAt DESC`
- `status_created`: `status ASC`, `createdAt DESC`
- `after_no`: `afterNo ASC`

建议后续补字段：

- `customerOpenid`: 创建售后的客户 `_openid`。

### 3.4 `invoices`

- `customer_created`: `customerId ASC`, `createdAt DESC`
- `order_created`: `orderId ASC`, `createdAt DESC`
- `status_created`: `status ASC`, `createdAt DESC`

建议后续补字段：

- `customerOpenid`: 创建发票申请的客户 `_openid`。

### 3.5 `test_reports`

- `code`: `code ASC`
- `batch_no`: `batchNo ASC`
- `tested_at`: `testedAt DESC`

## 4. 安全规则草案

以下规则为数据库直连阶段的基线草案。因为当前业务写操作仍在小程序端直写数据库，规则需要兼顾“能跑”和“边界收口”；强状态机校验建议放到云函数。

### 4.1 `users`

目标：

- 用户只能读取/更新自己的用户文档。
- 用户可创建自己的用户文档。
- 审核字段由后台或云函数写，前端只能提交认证申请字段。

规则草案：

```json
{
  "read": "auth.openid != null && doc._openid == auth.openid",
  "create": "auth.openid != null",
  "update": "auth.openid != null && doc._openid == auth.openid",
  "delete": "false"
}
```

风险：

- 当前 `adminLogin(username, password)` 通过小程序端查询 `users` 的管理员账号；收紧后非本人 `_openid` 管理员文档不可读。这是正确方向，但需要后台登录改为独立 Auth 或云函数。
- 当前 `loginByPhone(phone)` 仍是前端按手机号查询；规则收紧后只能查到当前 openid 对应的文档。建议后续废弃手机号直查登录。

### 4.2 `orders`

直连阶段最低规则：

```json
{
  "read": "auth.openid != null && doc._openid == auth.openid",
  "create": "auth.openid != null",
  "update": "auth.openid != null && doc._openid == auth.openid",
  "delete": "false"
}
```

问题：

- 订单由客户小程序创建时会自动写入 `_openid`，所以客户自己的订单可读。
- 制单员、客服、管理员、代理商跨用户读取订单无法仅靠此规则安全实现。
- 当前制单员发货和通用订单状态流转已下沉云函数；规则收紧前仍需继续清理遗留直写入口。

建议：

- `createOrder`、`payOrder`、`adjustOrderPrice`、`clerkShipOrder`、`updateOrderStatus` 已下沉云函数。
- 在订单写入时补 `customerOpenid`，并由云函数校验角色后执行后台类写操作。

### 4.3 `returns`

直连阶段最低规则：

```json
{
  "read": "auth.openid != null && doc._openid == auth.openid",
  "create": "auth.openid != null",
  "update": "auth.openid != null && doc._openid == auth.openid",
  "delete": "false"
}
```

建议：

- 售后申请可继续由客户创建。
- 售后审核、退款、等待寄回、质检、完成等状态流转下沉云函数。
- 后续补 `customerOpenid`，再将读规则改为 `doc.customerOpenid == auth.openid`。

### 4.4 `invoices`

直连阶段最低规则：

```json
{
  "read": "auth.openid != null && doc._openid == auth.openid",
  "create": "auth.openid != null",
  "update": "false",
  "delete": "false"
}
```

建议：

- 客户只能创建和读取自己的发票申请。
- 后台开票、驳回、上传发票文件由云函数或后台服务执行。
- `createInvoice` 下沉云函数后，应校验订单归属、支付状态和重复申请。

### 4.5 `test_reports`

检测报告存在“按公开检测码可查询”的业务需求，规则不能简单按 `_openid` 限制。

直连阶段读规则：

```json
{
  "read": "auth.openid != null",
  "create": "false",
  "update": "false",
  "delete": "false"
}
```

建议：

- 如果报告包含敏感信息，应改为云函数查询：入参 `code`，只返回可公开字段。
- 后台维护报告文件、检测项目和结论，不允许小程序端写。

## 5. 必须下沉云函数的接口

优先级从高到低：

1. `createOrder`: 校验登录、认证状态、商品可见性、血包购买权限、库存、地址、预约规则。
2. `payOrder`: 校验订单归属、待支付状态、改价后金额、支付回调或模拟支付状态。
3. `createInvoice`: 校验订单归属、支付状态、重复申请，写入 `customerOpenid`。
4. `processInvoice`: 已部署基础版，校验财务/管理员角色，支持开票、驳回、发票文件和纸票邮寄信息，并回写订单发票摘要。
5. `createReturn`: 校验订单归属、售后期限、商品售后策略、重复申请，上传凭证后写入 `customerOpenid`。
6. `reviewReturn`: 已部署基础版，校验客服/管理员角色和售后状态机，写入审核记录、质检结果、timeline 和日志。
7. `clerkShipOrder`: 校验制单员角色和订单状态，追加物流节点。
8. `adjustOrderPrice`: 已部署基础版，校验客服/管理员角色、只能降价、记录日志；通知客户待后续补微信订阅消息。
9. `updateOrderStatus`: 已部署基础版，校验客户本人/后台角色和订单状态机，记录操作日志。
10. `submitAgentApplication`: 已部署基础版，校验用户归属和基础表单字段，写入代理商申请。
11. `reviewAgentApplication`: 已部署基础版，校验客服/管理员角色，审核通过后开通 `salesperson` 角色并初始化代理商资金/客户字段。
12. `saveAgentBankCard`: 已部署基础版，校验用户归属和银行卡字段，写入本人银行卡。
13. `requestWithdrawal`: 已部署基础版，校验代理商资格、余额和银行卡，写入提现申请并扣减可提现余额。
14. `reviewWithdrawal`: 已部署基础版，校验财务/管理员角色和提现状态机；驳回时退回可提现余额，打款时写入完成时间。
15. `reviewVerification`: 已部署基础版，校验客服/管理员角色，审核医院认证并同步 `customerType = institution` 以闭环血包购买权限。
16. `queryTestReport`: 按公开检测码返回脱敏报告字段。

## 6. 近期执行顺序

1. 继续为 `orders`、`returns` 补建议索引，应用前先检查现有索引，避免重复创建。
2. 在订单、售后、发票新写入记录中补 `customerOpenid`。
3. 逐步把订单、售后、发货、支付改价、开票、医院认证、代理商申请和提现下沉云函数；`createOrder`、`payOrder`、`createInvoice`、`processInvoice`、`createReturn`、`reviewReturn`、`clerkShipOrder`、`adjustOrderPrice`、`updateOrderStatus`、`reviewVerification`、`submitAgentApplication`、`reviewAgentApplication`、`saveAgentBankCard`、`requestWithdrawal`、`reviewWithdrawal` 已完成基础版。
4. 云函数稳定后，再逐步收紧 `users`、`orders`、`returns` 安全规则。

## 7. 本地落地文件

- `packages/miniprogram/cloudbase/database-security-rules.json`: 机器可读安全规则草案。
- `packages/miniprogram/cloudbase/database-indexes.json`: 机器可读索引草案。
- `packages/miniprogram/miniprogram/services/index.ts`: 新建订单、售后、发票时已写入 `customerOpenid`。

## 8. 云端执行记录

2026-05-07 已在项目级环境 `cloudbase-d4gwpsm7gcc59b6fc` 完成：

- 创建 `invoices` 集合。
- 为 `invoices` 创建索引：`customer_created`、`order_created`、`status_created`。
- 设置 `invoices` 最小安全规则：登录用户可创建，用户只能读自己的记录，前端不可更新/删除。
- 创建 `test_reports` 集合。
- 为 `test_reports` 创建索引：`code`、`batch_no`、`tested_at`。
- 设置 `test_reports` 最小安全规则：登录用户可读，前端不可创建/更新/删除。
- 部署 `createOrder` 云函数，运行时 `Nodejs18.15`，状态 `Active / Available`。
- 部署 `updateOrderStatus` 云函数，运行时 `Nodejs18.15`，状态 `Active / Available`。
- 部署 `submitAgentApplication` 云函数。
- 部署 `reviewAgentApplication` 云函数。
- 部署 `saveAgentBankCard` 云函数。
- 部署 `requestWithdrawal` 云函数。
- 部署 `reviewReturn` 云函数。
- 部署 `reviewWithdrawal` 云函数。
- 部署 `processInvoice` 云函数。
- 部署 `reviewVerification` 云函数。

## 9. 后台接入记录

2026-05-07 已完成后台用户审核页第一版 CloudBase 接入：

- `packages/admin/src/lib/cloudbase-mcp.ts`: 服务端通过项目 `.mcp.json` 启动 CloudBase MCP 子进程，不向浏览器暴露云密钥。
- `packages/admin/src/app/api/cloudbase/users/route.ts`: 读取 CloudBase `users` 集合，返回客户、代理商和待审核代理申请。
- `packages/admin/src/app/api/cloudbase/users/review/route.ts`: 代理调用 `reviewVerification`、`reviewAgentApplication` 云函数。
- `reviewVerification`、`reviewAgentApplication` 已补服务端调用分支：无小程序 `OPENID` 时必须传后台操作人 ID，并由云函数校验其管理员/客服权限。

2026-05-07 已完成后台财务处理页第一版 CloudBase 接入：

- `packages/admin/src/app/api/cloudbase/finance/route.ts`: 读取 CloudBase `withdrawals`、`invoices` 集合，并代理调用 `reviewWithdrawal`、`processInvoice` 云函数。
- `packages/admin/src/app/(admin)/finance/page.tsx`: 新增提现审核和开票处理两个 tab。
- `packages/admin/src/components/admin/app-sidebar.tsx`: 新增“财务处理”入口。

2026-05-07 已完成后台退换货页第一版 CloudBase 接入：

- `packages/admin/src/app/api/cloudbase/returns/route.ts`: 读取 CloudBase `returns` 集合，并代理调用 `reviewReturn` 云函数。
- `packages/admin/src/app/(admin)/returns/page.tsx`: 售后列表、审核和状态推进改为走后台 CloudBase API。
- `reviewReturn` 已补服务端调用分支：无小程序 `OPENID` 时必须传后台操作人 ID，并由云函数校验其客服/管理员售后权限。
- 后台页面已兼容售后旧状态 `pending_return_ship/returned/verifying` 与云函数新状态 `customer_shipping/received`。

2026-05-07 已完成后台订单管理页第一版 CloudBase 接入：

- `packages/admin/src/app/api/cloudbase/orders/route.ts`: 读取 CloudBase `orders` 集合，并代理调用 `adjustOrderPrice`、`updateOrderStatus`、`clerkShipOrder` 云函数。
- `packages/admin/src/app/(admin)/orders/page.tsx`: 订单列表、筛选、指派制单员、改价、状态推进和发货改为走后台 CloudBase API。
- `packages/admin/src/app/(admin)/orders/[id]/page.tsx`: 订单详情读取和状态操作改为走后台 CloudBase API。
- `adjustOrderPrice`、`updateOrderStatus`、`clerkShipOrder` 已补服务端调用分支：无小程序 `OPENID` 时必须传后台操作人 ID，并由云函数校验后台角色权限。

2026-05-07 已补齐后台订单指派制单员 CloudBase 闭环：

- `packages/miniprogram/cloudfunctions/assignOrderToClerk`: 新增订单指派制单员云函数。
- `packages/admin/src/app/api/cloudbase/orders/route.ts`: 新增 `assign` 动作，代理调用 `assignOrderToClerk`。
- `assignOrderToClerk` 写入 `orders.clerkId/assignedAt/updatedAt`，并为制单员用户追加 `assignedOrderIds`。
- `assignOrderToClerk` 已创建部署到项目级环境 `cloudbase-d4gwpsm7gcc59b6fc`。

2026-05-07 已完成后台 dashboard、日志、系统配置第一版 CloudBase 接入：

- `packages/admin/src/app/api/cloudbase/dashboard/route.ts`: 聚合读取 CloudBase `orders/products/returns/users/config`。
- `packages/admin/src/app/api/cloudbase/logs/route.ts`: 读取 CloudBase `logs` 集合。
- `packages/admin/src/app/api/cloudbase/system/route.ts`: 读取并保存 CloudBase `config/system`。
- `packages/admin/src/app/(admin)/dashboard/page.tsx`: 仪表盘统计脱离 mock，读取 CloudBase 聚合数据。
- `packages/admin/src/app/(admin)/logs/page.tsx`: 操作日志脱离 mock。
- `packages/admin/src/app/(admin)/system/page.tsx`: 系统配置脱离 mock；保存会写回 CloudBase。

2026-05-07 已完成后台商品管理第一版 CloudBase 接入：

- `packages/admin/src/app/api/cloudbase/products/route.ts`: 读取 CloudBase `products/categories`，支持创建商品、局部更新商品、上下架和批量下架。
- `packages/admin/src/app/(admin)/products/page.tsx`: 商品管理页脱离 mock，读写 CloudBase。
- 商品更新使用 `$set`，避免覆盖整条商品文档。
- 商品创建/上下架写入 `logs` 操作日志。
- 已用测试数据完成真实写验证：创建 `codex_test_mov0lic7`，随后更新库存为 3 并下架。

2026-05-07 已补后台 CloudBase API 第一版统一权限守卫：

- `packages/admin/src/lib/admin-api-client.ts`: 前端统一携带后台用户最小身份头访问 `/api/cloudbase/*`。
- `packages/admin/src/lib/admin-api-auth.ts`: 服务端统一解析身份头，校验后台登录状态、账号启用状态、角色和权限。
- 已纳入守卫：`dashboard/logs/system/users/products/orders/returns/finance` 相关 CloudBase API。
- 该第一版守卫后续已升级为 HTTP-only session，详见下方“后台会话、审计与业务一致性收口”。

2026-05-07 已完成后台账号/角色第一版 CloudBase 接入：

- `packages/admin/src/app/api/cloudbase/accounts/route.ts`: 以 CloudBase `users` 集合承载后台账号，支持读取、创建、更新、删除。
- `packages/admin/src/app/api/cloudbase/accounts/login/route.ts`: 后台登录读取 CloudBase 后台账号。
- `packages/admin/src/app/api/cloudbase/roles/route.ts`: 读取角色权限和角色人数，保存时批量更新对应角色用户的 `permissions`。
- 后台账号角色使用 `service/product_manager/system_admin`。
- 开发阶段登录 API 会补齐默认测试后台账号 `admin_001/admin_002/admin_003`。
- 已用测试数据验证账号创建、禁用和删除链路。

## 10. 后台会话、审计与业务一致性收口

2026-05-07 已完成后台鉴权升级：

- `packages/admin/src/lib/admin-api-auth.ts`: 后台鉴权从可伪造的前端身份头升级为服务端签名 HTTP-only `admin_session` cookie。
- `packages/admin/src/app/api/cloudbase/accounts/login/route.ts`: 登录成功后签发会话 cookie。
- `packages/admin/src/app/api/cloudbase/accounts/session/route.ts`: 新增 session 读取和退出 API。
- `packages/admin/src/lib/admin-api-client.ts`: 前端请求改为 `credentials: 'same-origin'`，401 时清除本地展示态并跳转登录页。
- 每次后台 CloudBase API 请求都会回读 CloudBase `users` 集合，禁用账号后旧 cookie 会立即失效。
- 生产环境必须配置 `ADMIN_SESSION_SECRET`；`ADMIN_ALLOW_ANY_PASSWORD=true` 仅用于开发验收。

2026-05-07 已完成后台审计日志收口：

- `packages/admin/src/lib/admin-log.ts`: 新增统一后台操作日志写入 helper。
- 已覆盖账号、角色、商品、订单、售后、财务、系统配置、用户审核等关键写操作。
- `packages/admin/src/app/api/cloudbase/logs/route.ts`: 统一将 CloudBase `logs` 映射为后台 `OperationLog`。
- `packages/admin/src/app/(admin)/logs/page.tsx`: 新增日志详情弹窗和筛选。

2026-05-07 已完成后台真实业务写链路冒烟：

- `packages/admin/src/lib/cloudbase-function-result.ts`: 新增云函数返回值解析 helper，兼容 CloudBase MCP `invokeFunction` 返回结构。
- 后台 `orders/returns/finance/users/review` API 调用云函数时会注入当前后台操作人 ID 和名称。
- 已重部署并验证后台依赖云函数：`updateOrderStatus`、`reviewReturn`、`reviewWithdrawal`、`processInvoice`、`reviewVerification`、`reviewAgentApplication`、`assignOrderToClerk`、`clerkShipOrder`、`adjustOrderPrice`。
- 已补丁并重部署 `reviewWithdrawal`、`processInvoice`，允许后台服务端调用在无小程序 `OPENID` 时通过后台操作人校验。
- 已用临时真实数据验证订单推进、售后审核、发票处理、提现审核、商品上下架，并清理全部测试文档。

当前安全规则发布状态：

- `packages/miniprogram/cloudbase/database-security-rules.json` 已作为本地安全规则基线保留。
- 本轮没有直接远端发布 `orders/users/returns` 等旧核心集合规则，原因是仍有历史前端兼容路径，直接收紧可能破坏现有读写。
- 下一轮建议做“分阶段安全规则上线”：先补只读规则和日志观察，再逐步把写路径完全迁移到云函数，最后发布写规则。
