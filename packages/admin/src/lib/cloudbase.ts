'use client'

import { unwrapCloudFunctionResult } from './cloudbase-function-result'

/**
 * CloudBase SDK 延迟加载 - 避免顶层 import 在 Next.js 静态导出构建时
 * 触发 Node 环境的副作用。
 */

let _app: unknown = null

const ADMIN_SESSION_KEY = 'dxdy_admin_profile'
const DEFAULT_ADMIN_API_BASE = 'https://cloud1-d7g7ctn4m86bada89-1433980811.ap-shanghai.app.tcloudbase.com/admin-api'

type CloudbaseModule = {
  default: {
    init: (config: Record<string, unknown>) => unknown
  }
}

type CloudbaseApp = {
  auth?: ((options?: Record<string, unknown>) => unknown) | unknown
  database?: () => unknown
  callFunction?: (options: { name: string; data: Record<string, unknown> }) => Promise<unknown>
  uploadFile?: (options: Record<string, unknown>) => Promise<unknown>
}

function asApp(app: unknown): CloudbaseApp | null {
  return app && typeof app === 'object' ? app as CloudbaseApp : null
}

function getApp() {
  if (typeof window === 'undefined') return null
  if (!_app) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cloudbase = require('@cloudbase/js-sdk') as CloudbaseModule
    _app = cloudbase.default.init({
      env: 'cloud1-d7g7ctn4m86bada89',
      region: 'ap-shanghai',
      accessKey: process.env.NEXT_PUBLIC_CLOUDBASE_ACCESS_KEY!,
      auth: { detectSessionInUrl: true },
    })
  }
  return asApp(_app)
}

export { getApp }

export function getAuth() {
  const app = getApp()
  if (!app) return null
  return typeof app.auth === 'function' ? app.auth({ persistence: 'local' }) : app.auth
}

export function getDb() {
  const app = getApp()
  return app?.database ? app.database() : null
}

export async function ensureCloudbaseAuth() {
  return
}

export function getStoredAdminToken() {
  if (typeof window === 'undefined') return ''
  try {
    const stored = window.localStorage.getItem(ADMIN_SESSION_KEY)
    if (!stored) return ''
    const parsed = JSON.parse(stored) as { token?: unknown }
    return typeof parsed.token === 'string' ? parsed.token : ''
  } catch {
    return ''
  }
}

function getAdminApiBase() {
  return process.env.NEXT_PUBLIC_ADMIN_API_BASE || DEFAULT_ADMIN_API_BASE
}

/** 云函数调用 */
export async function callFunction<T = unknown>(name: string, data: Record<string, unknown>): Promise<T> {
  if (typeof window !== 'undefined') {
    const response = await fetch(getAdminApiBase(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, data }),
    })
    const payload = await response.json().catch(() => ({}))
    const result = unwrapCloudFunctionResult(payload)
    if (!response.ok) {
      throw new Error(String(result.error || '后台接口调用失败'))
    }
    return result as T
  }

  const app = getApp()
  if (!app?.callFunction) throw new Error('CloudBase not initialized')
  const res = await app.callFunction({ name, data })
  return unwrapCloudFunctionResult(res as Record<string, unknown>) as T
}

export default getApp
