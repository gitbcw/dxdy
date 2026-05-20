# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 项目概述

**大熊动医华南医学检验实验室** — 宠物医疗检测电商平台，包含微信小程序（C 端）和 Next.js 管理后台（B 端）。基于腾讯云开发（CloudBase）NoSQL 数据库 + 云函数。

## 常用命令

```bash
# Admin 本地开发
npm run dev:admin                    # → next dev (packages/admin)

# Admin 构建
npm run build -w packages/admin      # next build

# Admin 代码检查
npm run lint -w packages/admin       # eslint

# 小程序 TypeScript 检查
npm run typecheck -w packages/miniprogram

# 小程序开发者工具构建（生成 devtools 可用的 bundle）
npm run prepare:mini:devtools
```

**小程序开发**：用微信开发者工具打开 `packages/miniprogram/`，它自动编译 `.ts`，不要手动 `tsc`。

## Monorepo 结构

```
packages/
├── admin/        # Next.js 16 + shadcn/ui 管理后台
│   └── src/
│       ├── app/
│       │   ├── (auth)/login/      # 登录页
│       │   ├── (admin)/           # 认证 + 权限守卫的布局
│       │   │   ├── dashboard|products|orders|returns|finance|
│       │   │   ├── users|accounts|roles|system|logs/
│       │   │   └── layout.tsx     # routeAccess 权限映射
│       │   └── api/cloudbase/     # API 路由（代理云函数调用）
│       ├── components/admin/      # 管理后台专用组件
│       ├── components/ui/         # shadcn/ui 组件
│       ├── hooks/
│       └── lib/                   # cloudbase 客户端、类型定义、工具函数
└── miniprogram/   # 微信小程序
    ├── miniprogram/              # 小程序源码
    │   ├── app.ts                # 入口：云初始化、openid 获取、角色推导
    │   ├── services/index.ts     # 所有数据服务（直接 wx.cloud API）
    │   ├── components/           # product-action-sheet
    │   ├── custom-tab-bar/       # 自定义 tabBar
    │   └── pages/
    │       ├── home|catalog|cart|mine/   # tabBar 页
    │       ├── orders/                   # 订单创建/详情/支付
    │       ├── returns/                  # 退换货
    │       ├── agent/                    # 代理商（申请/客户/提现/订单）
    │       ├── salesman/                 # 业务员（推广/佣金/客户）
    │       ├── clerk/                    # 制单员（待处理/发货）
    │       ├── verify/                   # 实名认证
    │       └── ...
    ├── cloudfunctions/           # 17 个云函数
    └── typings/
```

## 关键架构决策

### 两端独立，互不依赖
- 小程序端：`packages/miniprogram/miniprogram/services/index.ts`，直接 `wx.cloud.database()` 操作
- 管理后台端：`packages/admin/src/`，通过 Next.js API Route 代理调用云函数
- 两端共享同一 CloudBase 环境和数据库，但代码完全独立

### Admin API 层
- `src/app/api/cloudbase/*` — Next.js API Route，服务端调用云函数
- `src/lib/admin-api-client.ts` — 前端 fetch 封装，自动处理 401 跳登录
- `src/lib/admin-api-auth.ts` — 服务端统一权限守卫
- `src/lib/cloudbase-function-result.ts` — 云函数返回值解包（RetMsg JSON 解析）
- `src/lib/types.ts` — 类型定义
- `src/lib/format.ts` — 业务工具函数（formatMoney, formatDateTime, maskPhone, defaultSystemConfig 等）

### 小程序数据流
- `app.ts` 启动时：`wx.cloud.init()` → `getOpenId` 云函数 → 从 `users` 集合匹配用户
- 用户缓存：`wx.setStorageSync('current_user')`，页面通过 `getCurrentUser()` 读取
- 角色：`customer`(personal/institution) / `salesperson` / `clerk` / `admin`
- 权限路由：`routeAccess` 映射每个管理模块到允许的角色

### 云函数
关键写操作走云函数（createOrder, payOrder, adjustOrderPrice, clerkShipOrder, createReturn, reviewReturn 等），简单 CRUD 直接 `wx.cloud.database()`。

## 云开发环境

- **环境 ID**：`cloud1-d7g7ctn4m86bada89`（上海，个人版）
- **小程序 appid**：`wxa418af3099ad148c`
- **主要集合**：users, products, categories, orders, returns, invoices, test_reports, commission_records, withdrawals, notifications, config
- **CloudBase MCP**：必须按项目 `.mcp.json` 启动/验证，避免误用全局 MCP 自动绑定的测试环境。详见 `docs/CLOUDBASE_MCP.md`

## 开发注意事项

- **不要手动 `tsc` 编译小程序**：微信开发者工具自动编译，手动 `tsc` 会产生 `.js` 冲突文件
- **小程序页面不能互相 require**：会报 `module is not defined`。共享逻辑放 `services/index.ts`
- **Next.js 16 有 breaking changes**：开发 admin 前先读 `node_modules/next/dist/docs/`，不要凭训练数据中的 Next.js API 写代码

## 当前进度

详见 **`docs/PROGRESS.md`** — 项目进度基准文档（各端完成状态、云端资源、下一步计划、文档索引）。新 AI 进入项目时先读这篇。
