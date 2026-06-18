# 项目部署与运维备忘

本文档记录小程序云函数、CloudBase 相关部署命令及踩坑经验，供后续开发和 AI 协查参考。

## 环境信息

- **CloudBase 环境 ID**：`cloud1-d7g7ctn4m86bada89`
- **小程序 appid**：`wx6f957efa365f4c03`
- **微信开发者工具路径**：`C:/MyFile/editor/微信web开发者工具/cli.bat`
- **小程序项目根目录**：`packages/miniprogram`
- **云函数目录**：`packages/miniprogram/cloudfunctions/`

## 云函数部署

### 完整部署（推荐，含云端安装依赖）

适用于首次部署、新增依赖或需要更新 `node_modules` 的场景。

```bash
"C:/MyFile/editor/微信web开发者工具/cli.bat" cloud functions deploy \
  --env cloud1-d7g7ctn4m86bada89 \
  --names payOrder \
  --project "C:/MyFile/workspace/projects/dxdy/packages/miniprogram" \
  --remote-npm-install
```

### 增量部署（仅更新指定文件）

适用于只修改了 `index.js` 且未变更 `package.json` 依赖的场景。

```bash
"C:/MyFile/editor/微信web开发者工具/cli.bat" cloud functions inc-deploy \
  --env cloud1-d7g7ctn4m86bada89 \
  --name payOrder \
  --file index.js \
  --project "C:/MyFile/workspace/projects/dxdy/packages/miniprogram"
```

### 查看云函数状态

```bash
"C:/MyFile/editor/微信web开发者工具/cli.bat" cloud functions info \
  --env cloud1-d7g7ctn4m86bada89 \
  --names payOrder \
  --project "C:/MyFile/workspace/projects/dxdy/packages/miniprogram"
```

## 已知问题与 workaround

### `cloud functions deploy` 返回 `41002 system error`

**现象**：完整部署时返回：

```text
{"message":"Error: getCloudAPISignedHeader failed: {\"base_resp\":{\"ret\":41002,\"errmsg\":\"system error.\"}}"}
```

**发生时间**：2026-06-18，部署 `payOrder` 云函数时。

**处理方案**：

1. 确认只是修改了 `index.js`，没有新增/变更 `package.json` 依赖。
2. 改用**增量部署**只上传 `index.js`：

   ```bash
   "C:/MyFile/editor/微信web开发者工具/cli.bat" cloud functions inc-deploy \
     --env cloud1-d7g7ctn4m86bada89 \
     --name payOrder \
     --file index.js \
     --project "C:/MyFile/workspace/projects/dxdy/packages/miniprogram"
   ```

3. 部署后通过 `cloud functions info` 确认函数状态变为 `Active`。

**注意**：增量部署不会更新云端 `node_modules`。如果后续修改了依赖，仍需解决完整部署的 41002 错误（可重试、检查网络/IDE 版本，或在微信开发者工具 GUI 中手动右键部署）。

## Admin 静态托管部署

Admin 端部署在 CloudBase 静态托管 `/cloud-admin` 路径。必须使用：

```bash
npm run build -w packages/admin
```

该脚本会执行 Next.js 16 App Router RSC 静态导出兼容补丁。不要直接上传未补丁的 `next build` 产物。

详见 **`docs/ADMIN_STATIC_HOSTING.md`**。
