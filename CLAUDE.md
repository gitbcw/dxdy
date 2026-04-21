# CLAUDE.md — dxdy 项目

## 项目架构

- **monorepo 结构**：`packages/shared`（共享层，供 admin 使用）、`packages/miniprogram`（微信小程序）、`packages/admin`（管理后台）
- **小程序独立**：`packages/miniprogram/miniprogram/shared/src/` 和 `packages/shared/src/` 是两套完全独立的代码，内容相似但无任何依赖关系。**不要做同步，不要互相参考推断。** 修改小程序时只看小程序目录内的文件，修改 admin 时只看 `packages/shared` 内的文件。
- **不要手动编译**：微信开发者工具会自动编译 `.ts` 文件。不要运行 `tsc` 生成 `.js`，这会导致重复文件冲突。
- **不要直接 require 其他页面**：小程序页面模块不能互相 require（会报 `module is not defined`）。共享逻辑放 `shared/src/services/`，通过 `services/index.ts` 桥接导出。
