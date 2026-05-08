# 大熊动医 — 项目进度基准

> 最后更新：2026-05-08 (b947b30)
> 本文档是新 AI 进入项目时的**入口文档**，读完这篇就知道项目做到哪了、下一步做什么。

## 一句话总结

P0 阶段已完成。P1 UI 重构进行中：全站 SVG 图标系统已落地，制单员冷链发货增强（包装/冷链/温度/修改物流），代理商申请流程优化。下一步继续 **P1：上线前安全收口 + 业务补齐**。

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
| 检测查询/报告 | 部分完成 | 可查 `test_reports`，缺后台维护报告能力 |
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
| 已发货订单 | 部分完成 | 缺今日发货、配送中、已签收视角 |

### 1.4 后台管理（Next.js）

| 页面 | 数据源 | 状态 |
|------|--------|------|
| 登录 | CloudBase `users` | 已完成（HTTP-only session） |
| 仪表盘 | CloudBase 聚合 | 已完成 |
| 商品管理 | CloudBase `products/categories` | 已完成（含创建/编辑/上下架） |
| 订单管理 | CloudBase `orders` | 已完成（含改价/发货/指派/状态流转） |
| 售后管理 | CloudBase `returns` | 已完成（含审核全流程） |
| 财务处理 | CloudBase `withdrawals/invoices` | 已完成（提现审核+开票处理） |
| 用户管理 | CloudBase `users` | 已完成（含医院认证/代理商审核） |
| 账号管理 | CloudBase `users` | 已完成（后台账号 CRUD） |
| 角色管理 | CloudBase `users` 权限 | 已完成（按角色更新 permissions） |
| 系统配置 | CloudBase `config/system` | 已完成 |
| 操作日志 | CloudBase `logs` | 已完成（详情弹窗+筛选） |

**后台安全**：
- HTTP-only `admin_session` cookie 鉴权，禁用账号旧 session 立即失效
- 统一权限守卫：`admin-api-auth.ts` 按角色和权限校验
- 统一审计日志：`admin-log.ts` 覆盖所有关键写操作
- 生产必须 `ADMIN_SESSION_SECRET`，开发任意密码需显式 `ADMIN_ALLOW_ANY_PASSWORD`

---

## 2. 云端资源清单

### 2.1 已部署云函数（16 个）

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

### 2.2 数据库集合（12 个）

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

### P1-1：上线前安全与运维收口（建议最先做）

- 分阶段发布 CloudBase 核心集合安全规则
- 后台真实密码初始化/重置流程
- 审计日志增强（失败日志、操作者筛选、对象跳转）
- 商品页 `<img>` warning 处理

### P1-2：行业能力增强

- 血包检测追溯、一包一码、检测报告后台维护
- 加急血包规则
- 血包卡券完整流程
- 微信服务号通知和后台待办
- 后台提成管理、卡券管理独立模块

### P1-3：制单员履约补齐（已完成）

- ~~发货成功页~~
- ~~独立物流详情/修改物流~~
- ~~备货中状态流转~~
- ~~修复 clerk/pending 硬编码数据~~
- 今日发货/配送中/已签收视角（待做）

### P2/P3：运营增长与数据化

详见 `docs/superpowers/specs/2026-05-07-dxdy-new-prd-gap-analysis.md` 第 4 节。

---

## 4. 已知限制

- `orders/users/returns` 安全规则尚未正式收紧，前端仍有直写路径
- 后台默认账号使用占位密码，生产前需初始化
- 支付为模拟支付，未接真实支付回调
- 代理商路由仍用 `salesman` 前缀
- `packages/shared` 已废弃并于 `acf4023` 提交中删除

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
