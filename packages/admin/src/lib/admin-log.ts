import { appendAdminLog } from '@/lib/services/database'
import type { AdminProfile } from '@/hooks/use-auth'

export type AdminLogInput = {
  operator?: AdminProfile | null
  action: string
  target: string
  detail: string
  result?: 'success' | 'failure'
}

function formatBeijingLogTime(date = new Date()) {
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const y = beijing.getUTCFullYear()
  const m = String(beijing.getUTCMonth() + 1).padStart(2, '0')
  const d = String(beijing.getUTCDate()).padStart(2, '0')
  const h = String(beijing.getUTCHours()).padStart(2, '0')
  const min = String(beijing.getUTCMinutes()).padStart(2, '0')
  const s = String(beijing.getUTCSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}:${s}+08:00`
}

export async function writeAdminLog(input: AdminLogInput) {
  await appendAdminLog({
    operatorId: input.operator?.id || 'unknown',
    operatorName: input.operator?.realName || '未知操作人',
    operatorRole: input.operator?.role || 'unknown',
    action: input.action,
    target: input.target,
    detail: input.detail,
    result: input.result || 'success',
    createdAt: formatBeijingLogTime(),
  })
}
