'use client'

/**
 * CloudBase SDK 延迟加载 — 避免顶层 import 在 Next.js 静态导出构建时
 * 触发 Node 环境的副作用（ws 模块加载）。
 */

let _app: any = null

function getApp() {
  if (typeof window === 'undefined') return null
  if (!_app) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cloudbase = require('@cloudbase/js-sdk')
    _app = cloudbase.default.init({
      env: 'cloud1-d7g7ctn4m86bada89',
      region: 'ap-shanghai',
      accessKey: process.env.NEXT_PUBLIC_CLOUDBASE_ACCESS_KEY!,
      auth: { detectSessionInUrl: true },
    })
  }
  return _app
}

export { getApp }

export function getAuth() {
  const app = getApp()
  return app ? app.auth : null
}

export function getDb() {
  const app = getApp()
  return app ? app.database() : null
}

/** 云函数调用 */
export async function callFunction<T = unknown>(name: string, data: Record<string, unknown>): Promise<T> {
  const app = getApp()
  if (!app) throw new Error('CloudBase not initialized')
  const res = await app.callFunction({ name, data })
  return res.result as T
}

export default getApp
