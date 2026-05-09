'use client'

import cloudbase from '@cloudbase/js-sdk'

const app = cloudbase.init({
  env: 'cloudbase-d4gwpsm7gcc59b6fc',
  region: 'ap-shanghai',
  accessKey: process.env.NEXT_PUBLIC_CLOUDBASE_ACCESS_KEY!,
  auth: { detectSessionInUrl: true },
})

export { app }
export const auth = app.auth
export const db = app.database()

/** 云函数调用 */
export async function callFunction<T = unknown>(name: string, data: Record<string, unknown>): Promise<T> {
  const res = await app.callFunction({ name, data })
  return res.result as T
}

export default app
