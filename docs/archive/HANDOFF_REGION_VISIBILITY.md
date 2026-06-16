# 商品区域可见性功能 · 归档记录

> **状态**：✅ 全部完成，2026-06-16 归档。
> 原为任务交接文档，功能完成后转为完成记录留存，不再是待办清单。

## 功能

让运营配置商品只在特定城市可见/销售（或屏蔽特定城市），通过 `visibleRegions`（白名单）/ `hiddenRegions`（黑名单）实现。前端过滤 + 后端拦截三道关卡闭合：列表/详情 → 加购（manageCart）→ 下单（createOrder）。

## 设计规则（供后续维护参考）

- `visibleRegions` 为空 = 全国可见；非空 = 仅这些城市可见
- `hiddenRegions` 优先级高于白名单
- 用户城市 = 默认收货地址 `city`（非实时定位）；无地址 / 无城市 = 全国可见
- 区域不可见直接判定为不可见，不再判断角色可见性

## 完成清单（全部 ✅）

**前端**（更早完成）：
- `admin/src/lib/types.ts:138-139` — Product 类型扩展 visibleRegions / hiddenRegions
- `admin/src/app/(admin)/products/page.tsx` — 编辑/新增表单「可见/不可见城市」
- `miniprogram/services/index.ts` — getUserDefaultCity / isRegionVisible / canViewProduct / getProducts 过滤
- `pages/home/home.ts:123`、`pages/catalog/catalog.ts:89` — 首页/分类继承过滤
- `pages/product-detail/product-detail.ts:43` — 详情页校验弹窗

**后端**（2026-06-16 完成）：
- `cloudfunctions/createOrder/index.js` — 新增 getCustomerCity / isRegionVisible，isVisibleToCustomer 接入区域校验；下单错误提示拆分区域/类型
- `cloudfunctions/manageCart/index.js` — addItem 入口加区域校验；修复 6 处编码乱码（98/144/147/180/181/182）
- `cloudfunctions/createOrder/rules.js` — 删除（孤儿死代码 + 编码损坏）

## 验证状态

- ✅ `node --check`（createOrder + manageCart 语法通过）
- ✅ `npm run typecheck -w packages/miniprogram`（无错误）
- ⏳ 云端人工验证：部署后执行（见下）

## 部署

```bash
cd packages/miniprogram
tcb fn deploy createOrder
tcb fn deploy manageCart
```

## 人工测试指引

### ⚠️ 关键前提

`hiddenRegions` / `visibleRegions` 里填的城市名，必须与用户收货地址的 `city` 字段**字符串完全一致**（如统一用「广州市」，不能一个带「市」一个不带），否则匹配失败、过滤失效。

### 准备测试数据

- 商品 A：`hiddenRegions = ['广州']`（黑名单）
- 商品 B：`visibleRegions = ['深圳']`（白名单）
- 两个测试地址：city 分别为「广州」「深圳」

### 1. 前端过滤

| 用户 | 商品A（黑名单广州） | 商品B（白名单深圳） |
|------|------|------|
| 广州 | ❌ 不可见 | ❌ 不可见 |
| 深圳 | ✅ 可见 | ✅ 可见 |

- 广州用户首页/分类看不到 A、B
- 广州用户经分享链接进 A 详情 → 弹「商品不可见 / 该商品在您所在区域暂不销售」并返回

### 2. 后端拦截（关键，验证本次改动）

前后端逻辑一致，前端不可见的商品正常无法下单。验证后端拦截需**模拟绕过前端**，在微信开发者工具 Console 直接调云函数：

```js
// 模拟广州用户下单被黑名单的商品A
wx.cloud.callFunction({ name: 'createOrder', data: {
  customerId: '<当前广州登录用户的 _id>',
  items: [{ productId: '<商品A 的 _id>', quantity: 1 }]
}}).then(r => console.log(r.result))
```

期望返回：`{ success: false, error: '该商品在您所在区域暂不销售：商品A' }`

同理测 manageCart 加购（应返回 `VISIBILITY_REGION` 错误）。

### 3. 回归

- 无区域配置的商品：广州/深圳均可正常看到、加购、下单
- 血包预约、卡券下单：原有校验不受影响
