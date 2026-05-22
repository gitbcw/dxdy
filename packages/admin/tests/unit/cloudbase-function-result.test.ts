import { describe, expect, it } from 'vitest'
import { unwrapCloudFunctionResult, type CloudFunctionResult } from '../../src/lib/cloudbase-function-result'

describe('unwrapCloudFunctionResult', () => {
  it('unwraps nested RetMsg payloads', () => {
    expect(unwrapCloudFunctionResult({
      data: { invokeResult: { RetMsg: '{"success":true,"value":1}' } },
    })).toEqual({ success: true, value: 1 })
  })

  it('falls back to data and result', () => {
    expect(unwrapCloudFunctionResult({
      data: { success: false, error: 'bad' },
    })).toEqual({ success: false, error: 'bad' })
    expect(unwrapCloudFunctionResult({
      result: { success: true, value: 2 },
    })).toEqual({ success: true, value: 2 })
  })

  it('preserves a top-level business wrapper when data is the payload', () => {
    expect(unwrapCloudFunctionResult({
      success: true,
      data: { orders: [], products: [] },
    })).toEqual({ success: true, data: { orders: [], products: [] } })
  })

  it('handles malformed payloads defensively', () => {
    expect(unwrapCloudFunctionResult({
      data: { invokeResult: { RetMsg: 'not-json' } },
    })).toEqual({ data: { invokeResult: { RetMsg: 'not-json' } } })
    expect(unwrapCloudFunctionResult(null as unknown as CloudFunctionResult)).toBeNull()
  })
})
