import { beforeEach, describe, expect, it, vi } from 'vitest'

const callFunctionMock = vi.fn()

vi.mock('../../src/lib/cloudbase', () => ({
  callFunction: callFunctionMock,
}))

describe('admin function service', () => {
  beforeEach(() => {
    callFunctionMock.mockReset()
  })

  it('calls order functions with expected names', async () => {
    callFunctionMock.mockResolvedValue({ success: true })
    const { adjustOrderPrice, clerkShipOrder } = await import('../../src/lib/services/functions')
    await adjustOrderPrice({ orderId: 'o1', newPrice: 12, operatorId: 'u1', operatorName: 'Admin' })
    await clerkShipOrder({ orderId: 'o1', company: 'SF', trackingNo: 'SF1', operatorId: 'u1', operatorName: 'Admin' })

    expect(callFunctionMock).toHaveBeenNthCalledWith(1, 'adjustOrderPrice', { orderId: 'o1', newPrice: 12, operatorId: 'u1', operatorName: 'Admin' })
    expect(callFunctionMock).toHaveBeenNthCalledWith(2, 'clerkShipOrder', { orderId: 'o1', company: 'SF', trackingNo: 'SF1', operatorId: 'u1', operatorName: 'Admin' })
  })

  it('calls management functions with expected names', async () => {
    callFunctionMock.mockResolvedValue({ success: true })
    const { manageCoupon, manageProduct, manageTestReport } = await import('../../src/lib/services/functions')
    await manageCoupon({ action: 'createTemplate', name: 'coupon' })
    await manageProduct({ action: 'deleteProduct', productId: 'p1', operatorId: 'u1' })
    await manageTestReport({ action: 'deleteReport', reportId: 'r1' })

    expect(callFunctionMock.mock.calls.map(call => call[0])).toEqual(['manageCoupon', 'manageProduct', 'manageTestReport'])
  })

  it('calls remaining admin actions with expected names', async () => {
    callFunctionMock.mockResolvedValue({ success: true })
    const {
      assignOrderToClerk,
      updateOrderStatus,
      reviewReturn,
      reviewWithdrawal,
      processInvoice,
      reviewVerification,
      reviewAgentApplication,
    } = await import('../../src/lib/services/functions')

    await assignOrderToClerk({ orderId: 'o1', clerkId: 'c1', operatorId: 'u1', operatorName: 'Admin' })
    await updateOrderStatus({ orderId: 'o1', status: 'completed', operatorId: 'u1', operatorName: 'Admin' })
    await reviewReturn({ id: 'r1', status: 'approved', operatorId: 'u1', operatorName: 'Admin' })
    await reviewWithdrawal({ id: 'w1', approved: true, operatorId: 'u1', operatorName: 'Admin' })
    await processInvoice({ id: 'i1', status: 'processed', operatorId: 'u1', operatorName: 'Admin' })
    await reviewVerification({ userId: 'u2', approved: true, rejectReason: '', operatorId: 'u1', operatorName: 'Admin' })
    await reviewAgentApplication({ userId: 'u3', approved: false, rejectReason: 'bad', operatorId: 'u1', operatorName: 'Admin' })

    expect(callFunctionMock.mock.calls.map(call => call[0])).toEqual([
      'assignOrderToClerk',
      'updateOrderStatus',
      'reviewReturn',
      'reviewWithdrawal',
      'processInvoice',
      'reviewVerification',
      'reviewAgentApplication',
    ])
  })
})
