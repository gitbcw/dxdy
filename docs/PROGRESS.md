# 大熊动医 — 项目进度基准

> 最后更新：2026-05-09
> 本文档是新 AI 进入项目时的**入口文档**，读完这篇就知道项目做到哪了、下一步做什么。

## 一句话总结

P0-P2 已全部完成。P3 数据化运营核心功能已实施：埋点 SDK（10+ 页面采集，批量缓冲写入）、每日聚合云函数（漏斗/收入/客户/商品/代理五大维度）、后台数据分析看板（7 个 Recharts 图表组件：营收趋势、客户增长、订单分布、热销商品、转化漏斗、业务员贡献、复购指标）。下一步 **上线前收尾 / 微信支付接入**。

---

## 1. 各端完成状态

### 1.1 小程序 — 客户端

| 链路 | 状态 | 备注 |
|------|------|------|
| 登录/注册 | 已完成 | 后续改为真实 Auth，弱化测试入口 |
| 首页 | 已完成 | 补真实 banner、未认证血包权限提示 |
| 商品分类/详情 | 已完成 | P0 血包购买权限强校验已下沉 `createOrder` 云函数 |
| 确认订单/支付 | 已完成 | `createOrder`/`payOrder` 已云函数化，模拟支付 |
| 订单列表/详情 | 已完成 | 可查看物流、发票、售后入口 |
| 售后申请/进度 | 已完成 | `createReturn`/`reviewReturn` 已云函数化 |
| 发票申请 | 已完成 | `createInvoice`/`processInvoice` 已云函数化 |
| 收货地址 | 已完成 | 写回 `users.addresses` |
| 物流跟踪 | 已完成 | 读 `orders.shipping` |
| 检测查询/报告 | 已完成 | 结构化指标展示、五入口贯通、后台维护 |
| 医院认证 | 已完成 | `reviewVerification` 已云函数化 |
| 我的 | 已完成 | 已接订单计数和角色菜单分支 |

### 1.2 小程序 — 代理商端

| 链路 | 状态 | 备注 |
|------|------|------|
| 代理商申请 | 已完成 | `submitAgentApplication`/`reviewAgentApplication` 已云函数化 |
| 审核状态 | 已完成 | 展示审核中/通过/驳回 |
| 推广二维码/客户 | 已完成 | 已改代理商文案，客户详情已聚合订单/成交/售后 |
| 客户订单视角 | 已完成 | 按 `salespersonId` 查询，展示提成和售后状态 |
| 提成中心 | 已完成 | 读 `commission_records` |
| 提现/银行卡 | 已完成 | `saveAgentBankCard`/`requestWithdrawal`/`reviewWithdrawal` 已云函数化 |

**命名注意**：代理商页面路由仍沿用 `salesman`，后续应逐步统一为 `agent`。

### 1.3 小程序 — 制单员端

| 链路 | 状态 | 备注 |
|------|------|------|
| 待处理订单 | 已完成 | 读待发货/待确认/备货中订单，去掉硬编码数据 |
| 录入物流 | 已完成 | `clerkShipOrder` 已云函数化，支持冷链包装信息（包装类型/冷链方式/箱内温度）|
| 备货中状态流转 | 已完成 | `preparing` 状态，制单员可标记开始备货 |
| 发货成功页 | 已完成 | `clerk/ship-success`，发货后跳转展示 |
| 独立物流详情/修改物流 | 已完成 | `clerk/logistics`，支持修改快递公司和单号，已发货订单可修改物流（需填修改原因） |
| 已发货订单 | 已完成 | 5 tab 视角：待发货/今日发货/配送中/已签收/全部 |

### 1.4 后台管理（Next.js）

| 页面 | 数据源 | 状态 |
|------|--------|------|
| 登录 | CloudBase `users` | 已完成（HTTP-only session） |
| 仪表盘 | CloudBase 聚合 | 已完成（KPI + 数据分析图表区） |
| 商品管理 | CloudBase `products/categories` | 已完成（含创建/编辑/上下架） |
| 订单管理 | CloudBase `orders` | 已完成（含改价/发货/指派/状态流转） |
| 售后管理 | CloudBase `returns` | 已完成（含审核全流程） |
| 财务处理 | CloudBase `withdrawals/invoices` | 已完成（提现审核+开票处理） |
| 用户管理 | CloudBase `users` | 已完成（含医院认证/代理商审核） |
| 账号管理 | CloudBase `users` | 已完成（后台账号 CRUD） |
| 角色管理 | CloudBase `users` 权限 | 已完成（按角色更新 permissions） |
| 系统配置 | CloudBase `config/system` | 已完成 |
| 操作日志 | CloudBase `logs` | 已完成（详情弹窗+筛选） |
| 检测报告 | CloudBase `test_reports` | 已完成（列表/搜索/创建/编辑/删除/状态管理） |
| 提成管理 | CloudBase `commission_records` | 已完成（列表/搜索/筛选/汇总） |
| 卡券管理 | CloudBase `card_vouchers` | 已完成（列表/搜索/筛选/作废） |
| 评论管理 | CloudBase `product_reviews` | 已完成（列表/审核/驳回/回复） |

**后台安全**：
- HTTP-only `admin_session` cookie 鉴权，禁用账号旧 session 立即失效
- 统一权限守卫：`admin-api-auth.ts` 按角色和权限校验
- 统一审计日志：`admin-log.ts` 覆盖所有关键写操作
- 生产必须 `ADMIN_SESSION_SECRET`，开发任意密码需显式 `ADMIN_ALLOW_ANY_PASSWORD`

---

## 2. 云端资源清单

### 2.1 已部署云函数（22 个）

| 云函数 | 用途 |
|--------|------|
| `getOpenId` | 获取用户 openid |
| `createOrder` | 下单（含血包权限、库存、认证校验） |
| `payOrder` | 模拟支付，状态流转 |
| `adjustOrderPrice` | 待支付订单改价 |
| `updateOrderStatus` | 订单状态推进（含后台操作人） |
| `assignOrderToClerk` | 指派制单员 |
| `clerkShipOrder` | 制单员发货（含冷链包装信息、已发货订单修改物流） |
| `createReturn` | 创建售后 |
| `reviewReturn` | 售后审核全流程 |
| `createInvoice` | 创建发票申请 |
| `processInvoice` | 开票处理 |
| `submitAgentApplication` | 代理商申请 |
| `reviewAgentApplication` | 代理商审核 |
| `saveAgentBankCard` | 保存银行卡 |
| `requestWithdrawal` | 提现申请 |
| `reviewWithdrawal` | 提现审核/驳回/打款 |
| `reviewVerification` | 医院认证审核 |
| `manageTestReport` | 检测报告 CRUD |
| `manageCardVoucher` | 卡券赠送/认领/转赠/兑换/作废 |
| `createRechargeOrder` | 创建充值订单 |
| `manageReview` | 商品评论提交/审核/回复 |
| `aggregateDailyStats` | 每日数据分析聚合（漏斗/收入/客户/商品/代理） |

### 2.2 数据库集合（16 个）

| 集合 | 状态 |
|------|------|
| `users` | 已存在，安全规则待收紧 |
| `orders` | 已存在，安全规则待收紧 |
| `returns` | 已存在，安全规则待收紧 |
| `products` | 已存在 |
| `categories` | 已存在 |
| `config` | 已存在 |
| `logs` | 已存在 |
| `notifications` | 已存在 |
| `commission_records` | 已存在 |
| `withdrawals` | 已存在 |
| `invoices` | 已创建，已配索引和安全规则 |
| `test_reports` | 已创建，已配索引和安全规则 |
| `card_vouchers` | 已创建，已配索引和安全规则（卡券 7 状态生命周期） |
| `product_reviews` | 已创建，已配索引（商品评论，pending/approved/rejected 状态） |
| `tracking_events_batch` | 已创建，已配索引（批量埋点事件，sessionId + createdAt） |
| `analytics_daily` | 已创建，唯一索引 date（每日预聚合分析数据） |

**环境**：`cloudbase-d4gwpsm7gcc59b6fc`（上海，个人版）
**MCP 注意**：全局 MCP 可能指向测试环境，项目操作应使用项目 `.mcp.json` 绑定的环境。连接方式详见 `docs/CLOUDBASE_MCP.md`。

---

## 3. 下一步：P1

### P1-0：Computer Use 视觉走查（2026-05-08）

记录文档：`docs/superpowers/specs/2026-05-08-miniprogram-computer-use-visual-walkthrough.md`

首轮显著问题：

- 登录页新 hero 资产裁切过狠，品牌主体露出不足。
- 制单员首页出现 `undefined 等待发货`。
- 制单员首页无障碍树中出现客户购物浮层语义。
- DevTools Console 有 `Error: timeout`、`returns` 全表扫描告警、`orders(customerId, createdAt)` 组合索引建议。
- 登录页仍有 `DX` 文本 logo 和外露预置账号区，需在上线前弱化/隐藏。

### P1-1：P0 交易闭环收口（已完成 2026-05-08）

改动 1：**商品模型扩展** — ProductType 枚举（physical/blood_pack/test_service/card_voucher）替代 isBloodPack 布尔值；后台商品表单扩展 bookingConfig、purchaseLimit、agreementRequired 等字段。

改动 2：**canPurchase 统一预检** — services/index.ts 新增 canPurchase(product, user, options?)，统一校验商品状态、登录、可见性、血包权限、库存、购买限额。接入 product-detail、cart、orders/create 页面。

改动 3：**订单金额模型** — OrderPricing 扩展 shippingFee/urgentFee/pointsDeduction/refundedAmount；createOrder 和 adjustOrderPrice 佣金率改为从 config.system 读取；reviewReturn 审批退款时 _.inc(refundAmount) 累计 pricing.refundedAmount。

改动 4：**优惠券系统** — coupon_templates + user_coupons 双集合；manageCoupon 云函数（创建/发放/领取/作废）；createOrder 原子核销；小程序"我的优惠券"页面；后台优惠券管理模块。

改动 5：**制单员异常发货** — clerkShipOrder 支持 abnormalFlag/abnormalType/abnormalReason 参数；制单员物流详情页添加异常发货开关和表单；admin 订单详情展示异常 Badge。

**P1 售后规则增强（2026-05-08）**：

- 售后期限校验：createReturn 从 config.system 读取 returnDeadlineDays（默认 7 天），按订单 completedAt 判断
- 血包售后规则：血包商品仅允许 reasonType=quality（质量问题），不支持换货和无理由退换；售后申请页血包自动锁定质量问题
- reasonType 字段：新增 quality/change_of_mind/other 三种原因类型，写入 returns 记录
- ReturnType 统一：admin types 改为 refund_return/refund_only/exchange；后台列表正确显示三种类型
- 换货选项解锁：售后申请页非血包订单显示换货选项卡
- 订单列表修复："申请售后"按钮补全 catchtap 事件绑定
- 客户寄回物流：售后详情页审核通过后显示寄回物流填写表单；reviewReturn 接受 sendLogistics 参数
- 退货扣回提成：reviewReturn 退款完成时查 commission_records 扣回未结算提成，更新 commissionAdjust

**P1 代理提成闭环（2026-05-09）**：

- 提成记录生成：createOrder 向 commission_records 写入 pending 记录（含 salespersonId/orderId/amount/sourceType）
- 提成锁定：payOrder 支付成功后将 commission_records 改为 locked + orders.commission.status=locked
- 提成结算入账：updateOrderStatus 订单完成时 settled + 代理商 commission.total/available 余额增加
- 改价提成同步：adjustOrderPrice 同步更新 commission_records 金额 + 写 price_modification 调整记录
- 退款扣回余额：reviewReturn 扣减代理商 commission.total/available，余额不足记入 pendingDeduction
- 提现配置化：requestWithdrawal 从 config.system 读取 minWithdrawAmount 替代硬编码
- 财务页优化：提现列表展示代理商姓名 + 待审核/待审金额/累计提现三卡片汇总

- 手机号跨角色唯一校验：registerCustomer 全局查重（不区分 role）+ users 集合 phone 唯一索引
- 医院资质编号唯一校验：reviewVerification 审核通过前检查 businessLicense 不被其他已认证机构占用
- 代理绑定审计：新增 bindSalesperson 云函数（权限校验 + 防覆盖 + 旧绑定自动清理 + logs 审计）+ services 改调云函数
- 后台发货弹窗补全：functions.ts 类型扩展 + 弹窗增加冷链信息（血包必填）、修改原因、异常发货标记
- 换货发货待办：reviewReturn 在 exchange_shipping 时自动创建换货发货订单进入制单员待办 + 物流详情页换货标识

### P1-2：上线前安全与运维收口（已完成 2026-05-09）

- ~~数据库安全规则发布~~：11 个集合全部配 CUSTOM 安全规则（users/orders/returns/invoices/test_reports/products/categories/commission_records/withdrawals/logs/notifications），customerOpenid 回填完成
- ~~登录页清理~~：移除生产环境测试凭据提示（仅 development 显示），密码最低 6 位校验
- ~~密码安全~~：密码字段改为存 `***`（验证走 CloudBase Auth），创建/更新账号均校验密码长度
- ~~审计日志增强~~：login/logout 日志记录，日志页增加日期范围筛选
- ~~会话安全~~：admin layout 每 60 秒检查用户状态，被禁用自动登出

### P1-3：行业能力增强

- ~~血包检测追溯、一包一码、检测报告后台维护~~（已完成 2026-05-08）
  - manageTestReport 云函数（createReport/updateReport/deleteReport）
  - 后台检测报告管理页面（列表/搜索/创建/编辑/删除/状态管理）
  - 后台路由权限 + 侧栏导航 + test_reports 新索引（status, productName）
  - 小程序报告详情页结构化展示（指标值/单位/参考范围/结果判定）
  - 五入口贯通：首页检测查询、商品详情检测报告、订单详情已有、售后关联血包编号、扫码查询
  - 售后关联血包编号：createReturn 写入 bloodPackCode，售后申请页展示
- ~~加急血包规则~~（已完成 2026-05-09）
  - 后台商品页 urgentConfig 配置（启用/加急费/说明）
  - 小程序下单页加急开关 + 金额实时计算
  - createOrder 云函数读取商品 urgentConfig，写入 pricing.urgentFee 和 shipping.urgent
  - 后台订单详情加急 Badge 展示
- ~~后台提成管理独立模块~~（已完成 2026-05-09）
  - commissions/page.tsx 提成记录列表（按代理商/订单号搜索、按状态筛选）
  - 四卡片汇总（待结算/已锁定/已结算/已扣回）
  - database.ts 新增 fetchCommissionRecords
  - 路由权限 + 侧栏导航
- ~~血包卡券完整流程~~（已完成 2026-05-09）
- 微信服务号通知和后台待办（待做，需服务号配置）

### P1-4：制单员履约补齐（已完成）

- ~~发货成功页~~
- ~~独立物流详情/修改物流~~
- ~~备货中状态流转~~
- ~~修复 clerk/pending 硬编码数据~~
- ~~今日发货/配送中/已签收视角~~（已完成 2026-05-09）

### P2：运营增长核心闭环（已完成 2026-05-09）

- **P2-3 限时促销价**：Product 新增 promotionPrice/promotionStart/promotionEnd 字段；Admin 商品表单添加促销配置区；createOrder 云函数 getUnitPrice 支持促销价；小程序商品详情/分类/结账页展示促销标签、原价划线、倒计时
- **P2-1 积分闭环**：订单完成自动赚取积分（actualAmount × pointsRate）；下单时可使用积分抵扣（100积分=1元）；checkPointsExpiry 延迟过期检查；新增 pages/points/history 积分明细页；结账页添加积分抵扣选择
- **P2-2 钱包充值**：新增 createRechargeOrder 云函数；payOrder 支持充值入账（金额+赠送）和钱包扣款；新增 pages/wallet/recharge 充值页；Admin 系统配置添加 rechargeTiers 编辑器
- **P2-4 商品评论**：新建 product_reviews 集合；新增 manageReview 云函数（提交/审核/驳回/回复）；新增 pages/reviews/submit 评论提交页；商品详情页展示评论+平均分；订单详情 completed 状态添加"评价订单"按钮；新增 Admin 评论管理页
- **P2-5 拉新奖励**：Customer 新增 referralCode/referredBy 字段；registerCustomer 自动生成推荐码并支持推荐码参数；updateOrderStatus 首单完成奖励推荐人积分；新增 pages/referral/share 推荐分享页（推荐码+小程序分享）；Admin 系统配置添加 referralRewardPoints

### P3：数据化运营（已完成 2026-05-09）

- **埋点 SDK**：`services/tracking.ts` 批量缓冲（10 条/30 秒）写入 `tracking_events_batch`；覆盖 10+ 页面（home/catalog/product-detail/cart/orders/create/pay-result/reviews/submit/referral/share/mine）
- **每日聚合云函数**：`aggregateDailyStats` 聚合漏斗指标、收入/订单、客户增长、复购率、退款、热门商品 TOP20、代理贡献 TOP20，写入 `analytics_daily`
- **后台数据看板**：7 个 Recharts 图表组件 + 服务层（analytics.ts），集成到仪表盘页面
  - 营收趋势（30 天面积图，机构/个人双线）
  - 客户增长（柱+线复合图）
  - 订单状态分布（饼图）
  - 热销商品 TOP10（水平柱状图）
  - 转化漏斗（自定义 div，5 步：浏览→详情→加购→下单→支付）
  - 业务员贡献（堆叠柱状图，营收+佣金）
  - 复购与客单价（指标卡片）

---

## 4. 已知限制

- `orders/users/returns` 安全规则已发布，前端直写路径已受控
- 后台密码字段存 `***`，实际认证走 CloudBase Auth
- 支付为模拟支付，未接真实支付回调
- `packages/shared` 已废弃并于 `acf4023` 提交中删除
- 商品图片上传已改为 CloudBase Storage，新上传的图片存储为 `cloud://` URL

---

## 5. 文档索引

以下是 `docs/` 目录下所有项目文档，按用途分类。

### 活跃参考（当前仍有价值）

| 文档 | 内容 | 何时查阅 |
|------|------|----------|
| `CLAUDE.md`（项目根目录） | 项目结构、常用命令、架构决策、开发注意事项 | 每次开发前必读 |
| `CLOUDBASE_MCP.md` | 项目级 CloudBase MCP 与全局 MCP 的区别、正确验证方式、当前环境确认结果 | 每次做云端操作前先确认 |
| `specs/2026-05-07-dxdy-new-prd-gap-analysis.md` | 新 PRD 与当前系统的完整差异分析，P0-P3 优先级定义 | 需要了解"最终要做成什么样"时 |
| `specs/2026-05-07-cloudbase-collections-security-baseline.md` | 数据库集合清单、索引、安全规则基线 | 涉及数据库结构或安全规则时 |
| `specs/2026-05-07-dxdy-design-image-index.md` + `assets/dxdy-design/*.png` | 6 张设计图索引（客户 3 / 代理商 2 / 制单员 1） | 需要对照设计图时 |

### 执行记录（历史参考，不需要从头读）

| 文档 | 内容 | 备注 |
|------|------|------|
| `specs/2026-05-07-ui-function-acceptance-audit.md` | P0-1 至 P0-28 完整执行记录，900+ 行 | 最重要的历史文档，包含每个云函数的落地细节和验证结果 |
| `plans/2026-05-07-admin-cloudbase-checkpoint.md` | 后台 CloudBase 接入检查点 | P0-21 至 P0-28 摘要，已被 acceptance-audit 覆盖 |
| `specs/2026-05-07-cloudbase-business-interface-plan.md` | 云函数/集合接口改造对照 | 部分状态描述已过时，以实际代码为准 |

### 早期设计（已完成阶段，仅供参考）

| 文档 | 内容 |
|------|------|
| `specs/2026-04-15-dxdy-demo-design.md` | 初始 Demo 版系统设计（全部 mock，`packages/shared` 时代） |
| `specs/2026-04-16-dxdy-role-pages-design.md` | 制单员/业务员角色页面设计（mock 阶段） |
| `plans/2026-04-16-role-pages-implementation-plan.md` | 角色页面实现计划（mock 阶段） |
| `plans/2026-05-07-miniprogram-ui-alignment-plan.md` | 小程序 UI 对齐实施清单（设计图拆分和执行原则） |
