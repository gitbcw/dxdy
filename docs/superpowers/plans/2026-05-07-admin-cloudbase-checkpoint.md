# 后台 CloudBase 接入检查点

> 日期：2026-05-07  
> 环境：`cloud1-d7g7ctn4m86bada89`  
> 入口文档：
> - `docs/superpowers/specs/2026-05-07-ui-function-acceptance-audit.md`
> - `docs/superpowers/specs/2026-05-07-cloudbase-collections-security-baseline.md`
> - `packages/admin/README.md`

## 当前结论

后台 P0 主线已经完成到 P0-28：真实 CloudBase 数据接入、账号/角色权限、HTTP-only session、操作日志、核心业务写链路冒烟和第一轮生产安全收口均已落地。

换句话说，下次接上时不需要再从“后台是不是 mock”开始判断；现在应从“上线前安全与运维收口”继续。

## 已完成范围

- P0-21：后台账号/角色接入 CloudBase `users` 真实权限模型。
- P0-22：三角色端到端冒烟，覆盖 `system_admin/product_manager/service`。
- P0-23：后台鉴权从 `localStorage` 身份头升级为 HTTP-only `admin_session`。
- P0-24：关键后台写操作接入 CloudBase `logs` 审计日志。
- P0-25：后台订单、售后、财务、用户审核真实业务写链路完成 CloudBase 冒烟。
- P0-26：会话过期后前端自动清理并跳转登录页。
- P0-27：小程序产生的数据与后台审核/推进链路完成第一轮联动验证。
- P0-28：生产环境必须配置 `ADMIN_SESSION_SECRET`，开发任意密码开关收口到 `ADMIN_ALLOW_ANY_PASSWORD`。

## 关键文件

- `packages/admin/src/lib/admin-api-auth.ts`: 后台 session 签发、校验、清除和权限守卫。
- `packages/admin/src/lib/admin-api-client.ts`: 后台前端 API 请求 helper，处理 401 跳转。
- `packages/admin/src/lib/admin-log.ts`: 后台统一操作日志。
- `packages/admin/src/lib/cloudbase-function-result.ts`: CloudBase 云函数返回值解析。
- `packages/admin/src/app/api/cloudbase/accounts/login/route.ts`: 后台登录。
- `packages/admin/src/app/api/cloudbase/accounts/session/route.ts`: 后台 session 读取/退出。
- `packages/admin/src/app/api/cloudbase/accounts/route.ts`: 后台账号 CRUD。
- `packages/admin/src/app/api/cloudbase/roles/route.ts`: 后台角色权限读取/保存。
- `packages/miniprogram/cloudfunctions/reviewWithdrawal/index.js`: 已支持后台服务端调用。
- `packages/miniprogram/cloudfunctions/processInvoice/index.js`: 已支持后台服务端调用。

## 已验证

- `npm run lint -w packages/admin`：通过；仍有商品页既有 `<img>` warning。
- `npx tsc --noEmit -p packages/admin/tsconfig.json`：通过。
- `npm run build -w packages/admin`：通过。
- 无 cookie 访问后台 CloudBase API 返回 401。
- 伪造 `x-admin-user` 访问后台 CloudBase API 返回 401。
- 禁用后台账号后旧 cookie 立即失效。
- 订单推进、售后审核、发票处理、提现审核、商品上下架均通过真实 CloudBase 写验证。
- 冒烟测试创建的临时订单、售后、发票、提现、商品、账号数据已清理。

## 运行与环境备注

- 后台开发服务通常跑在 `http://localhost:3002`。
- CloudBase 操作应继续使用项目 `.mcp.json` 绑定环境；全局 MCP 曾指向其他测试环境，不要混用。
- 生产环境必须配置 `ADMIN_SESSION_SECRET`。
- `ADMIN_ALLOW_ANY_PASSWORD=true` 只允许用于开发验收，不应进入生产环境。
- 当前默认后台账号用于开发和验收；生产前需要真实密码初始化、邀请或重置流程。

## 下次建议做什么

下一步建议开 **P1-1：上线前安全与运维收口**。

优先顺序：

1. 分阶段发布 CloudBase 核心集合安全规则：先只读规则，再迁移剩余写路径到云函数，最后收紧写规则。
2. 补后台真实密码初始化/重置流程，替换默认种子账号占位密码。
3. 增强操作日志：失败日志、操作者筛选、目标对象跳转、导出。
4. 处理商品页 `<img>` warning 和生产图片策略。
5. 再进入 P1 业务补齐：通知中心、优惠券/活动、报表、提成结算、检测报告维护、代理商/制单员体验增强。

## 不建议下次重复做

- 不需要重新判断后台页面是否仍为 mock；商品、订单、售后、财务、用户审核、仪表盘、日志、系统、账号、角色均已接 CloudBase。
- 不需要恢复 `localStorage admin_user` 身份头方案；它已经被 HTTP-only session 取代。
- 不要直接远端发布旧核心集合安全规则；需要先做分阶段方案和回归验证。
