import { appendAdminLog } from '@/lib/services/database'
import type { AdminProfile } from '@/hooks/use-auth'

export type AdminLogInput = {
  operator?: AdminProfile | null
  action: string
  target: string
  detail: string
  result?: 'success' | 'failure'
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
    createdAt: new Date().toISOString(),
  })
}
