# 大熊动医 P0-P3 验收方案与首轮结果

> 日期：2026-05-09  
> 范围：`req.md`、PRD gap 盘点、`docs/PROGRESS.md` 中声明完成的 P0-P3、小程序、云函数、后台管理、CloudBase 规则/索引。  
> 目标：验证“gap 已补齐”的代码闭环，而不是只核对进度文档。

## 1. 验收策略

### 1.1 机器门禁

- 后台：`npm run lint -w packages/admin`
- 后台：`npm run build -w packages/admin`
- 小程序：`npm run typecheck -w packages/miniprogram`
- 小程序：`npm run build:devtools -w packages/miniprogram`
- 云函数目录完整性：每个云函数应具备可部署所需的 `index.js`、`package.json`、`config.json`

### 1.2 功能闭环抽查

- P0 交易履约：商品权限、下单、支付、库存、改价、指派、发货、订单完成。
- P1 售后/代理/行业能力：售后期限与血包规则、寄回物流、换货发货、提成锁定/结算/扣回、检测报告、一包一码。
- P2 增长能力：促销价、积分、钱包充值、评论、拉新奖励、优惠券。
- P3 数据化运营：埋点写入、每日聚合、后台图表字段口径。

### 1.3 数据与安全验收

- 新增集合是否都有安全规则：卡券、评论、优惠券、埋点、分析日报等。
- 高频查询是否都有索引：卡券状态/持有人、评论商品/状态、埋点日期、分析日报日期、提成按代理/订单/状态。
- 前端直写集合是否被安全规则限制到当前用户或云函数路径。

### 1.4 人工场景验收

- 以四类账号跑端到端流程：个人客户、机构客户、代理商、制单员，再加后台客服/管理员。
- 每个流程保留订单号、售后单号、卡券号、检测报告编号、日志记录截图或导出数据。

## 2. 首轮机器门禁结果

| 检查项 | 结果 | 说明 |
| --- | --- | --- |
| 后台 lint | 未通过 | 52 个 error、27 个 warning，主要为 `no-explicit-any` 和未使用变量 |
| 后台 build | 通过 | Next.js 生产构建成功，21 个路由生成成功 |
| 小程序 typecheck | 通过 | TypeScript 检查通过 |
| 小程序 DevTools 构建 | 通过 | 已生成 `miniprogram/app.js` 和各页面 JS |
| 云函数目录完整性 | 未通过 | 24 个云函数中 7 个缺少 `config.json`，其中 6 个也缺 `package.json` |

## 3. 首轮阻塞问题

### A1. P3 数据分析聚合字段口径错误

`aggregateDailyStats` 读取订单收入字段 `totalAmount`，但 `createOrder` 写入的是 `pricing.originalAmount` / `pricing.actualAmount`；读取订单客户类型 `customerType`，但订单创建时没有写入该字段。结果是收入、个人/机构收入可能为 0 或全部落到个人侧。

同一云函数读取提成字段 `orderAmount` / `commission`，但 `commission_records` 写入的是 `amount`；热销商品收入读取 `item.price`，但订单 item 写入的是 `unitPrice` / `totalPrice`。这会直接影响后台 P3 数据看板可信度。

### A2. CloudBase 安全规则没有覆盖 P2/P3 新集合

本地安全规则只覆盖 11 个集合；`card_vouchers`、`product_reviews`、`coupon_templates`、`user_coupons`、`tracking_events_batch`、`analytics_daily` 等 P2/P3 新集合未在 `database-security-rules.json` 中声明。若线上未单独配置，验收不能判定为安全收口。

另外 `commission_records` / `withdrawals` 使用 `doc.salespersonId == auth.uid`，但代码里 `salespersonId` 是 `users` 文档 `_id`，需要确认 CloudBase `auth.uid` 是否等于业务用户文档 `_id`；否则代理商小程序可能读不到自己的提成/提现记录。

### A3. 云函数目录不完整，影响可重复部署验收

以下新增云函数缺少 `config.json`：`aggregateDailyStats`、`bindSalesperson`、`createRechargeOrder`、`manageCardVoucher`、`manageCoupon`、`manageReview`、`manageTestReport`。

以下新增云函数缺少 `package.json`：`bindSalesperson`、`createRechargeOrder`、`manageCardVoucher`、`manageCoupon`、`manageReview`、`manageTestReport`。

### A4. 后台 lint 未通过

后台生产构建能过，但 lint 仍有 52 个错误。若以“上线前质量门禁”为标准，当前不能通过验收。

## 4. 首轮通过项

- 小程序类型检查通过。
- 小程序 DevTools 构建脚本通过。
- 后台 Next.js 生产构建通过，路由包括 dashboard、orders、returns、reports、commissions、cards、coupons、reviews 等。
- 代码中能看到交易、售后、发货、提成、卡券、评论、钱包、积分、埋点等主链路实现，不是空页面或纯文档完成。

## 5. 下一步验收动作

1. 修复或确认 A1-A4 后重跑机器门禁。
2. 用固定测试数据执行 12 条端到端人工场景：个人下单、机构认证、血包下单、改价支付、发货签收、售后退款、换货、代理推广绑定、提成结算/扣回、卡券购买赠送兑换核销、评论审核、数据聚合看板。
3. 对 CloudBase 线上环境核对集合、索引、安全规则、云函数部署版本，确认本地声明与线上一致。
4. 输出最终验收结论：通过 / 有条件通过 / 不通过，并列出上线前必须修复项。

## 6. 阻塞项修复记录

> 修复日期：2026-05-09

- A1 已修复：`aggregateDailyStats` 改为读取 `pricing.actualAmount`、`item.totalPrice` / `item.unitPrice`、`commission_records.amount`，并用日期字符串范围兼容云函数写入的 `YYYY-MM-DD HH:mm` 时间格式。
- A2 已修复：本地安全规则补齐 `coupon_templates`、`user_coupons`、`card_vouchers`、`product_reviews`、`tracking_events_batch`、`analytics_daily`；索引补齐提成、提现、优惠券、卡券、评论、埋点、分析日报。
- A3 已修复：新增云函数补齐 `config.json` / `package.json`，云函数目录完整性检查无缺失。
- A4 已修复：后台 lint 从 52 error 降为 0 error，仅剩 4 个非阻塞 warning。

复验结果：

| 检查项 | 结果 |
| --- | --- |
| `npm run lint -w packages/admin` | 通过，0 error / 4 warning |
| `npm run build -w packages/admin` | 通过 |
| `npm run typecheck -w packages/miniprogram` | 通过 |
| `npm run build:devtools -w packages/miniprogram` | 通过 |
| CloudBase JSON 配置解析 | 通过 |
| 云函数目录完整性 | 通过 |
