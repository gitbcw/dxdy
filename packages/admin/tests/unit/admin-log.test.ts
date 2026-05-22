import { beforeEach, describe, expect, it, vi } from 'vitest'

const appendAdminLogMock = vi.fn(async () => {})

vi.mock('../../src/lib/services/database', () => ({
  appendAdminLog: appendAdminLogMock,
}))

describe('writeAdminLog', () => {
  beforeEach(() => {
    appendAdminLogMock.mockClear()
  })

  it('writes an operation log with operator information', async () => {
    const { writeAdminLog } = await import('../../src/lib/admin-log')
    await writeAdminLog({
      operator: { id: 'u1', username: 'admin', realName: 'Admin', role: 'system_admin', permissions: {}, status: 'active' },
      action: 'save',
      target: 'products',
      detail: 'saved product',
    })

    expect(appendAdminLogMock).toHaveBeenCalledWith(expect.objectContaining({
      operatorId: 'u1',
      operatorName: 'Admin',
      operatorRole: 'system_admin',
      action: 'save',
      result: 'success',
    }))
  })

  it('falls back to unknown operator fields', async () => {
    const { writeAdminLog } = await import('../../src/lib/admin-log')
    await writeAdminLog({
      operator: null,
      action: 'delete',
      target: 'orders',
      detail: 'deleted order',
      result: 'failure',
    })

    expect(appendAdminLogMock).toHaveBeenCalledWith(expect.objectContaining({
      operatorId: 'unknown',
      operatorName: '未知操作人',
      operatorRole: 'unknown',
      result: 'failure',
    }))
  })
})
