import { describe, expect, it } from 'vitest'
import { getLoginLandingPath, hasUsableToken, normalizeProfile } from '../../src/hooks/auth-helpers'

function makeToken(exp: number) {
  const body = Buffer.from(JSON.stringify({ exp })).toString('base64url')
  return `${body}.signature`
}

describe('auth helpers', () => {
  it('normalizes allowed admin profiles', () => {
    expect(normalizeProfile({
      _id: 'u1',
      username: 'service',
      realName: 'Service',
      role: 'service',
      status: 'active',
      permissions: { view_dashboard: true },
    })).toEqual({
      id: 'u1',
      username: 'service',
      realName: 'Service',
      role: 'service',
      permissions: { view_dashboard: true },
      status: 'active',
    })
  })

  it('rejects disabled or non-admin users', () => {
    expect(normalizeProfile({ _id: 'u2', username: 'x', role: 'customer', status: 'active' })).toBeNull()
    expect(normalizeProfile({ _id: 'u3', username: 'x', role: 'service', status: 'disabled' })).toBeNull()
  })

  it('returns landing paths for login', () => {
    expect(getLoginLandingPath('system_admin')).toBe('/dashboard')
    expect(getLoginLandingPath('product_manager')).toBe('/products')
    expect(getLoginLandingPath('service')).toBe('/orders')
  })

  it('requires cached admin profiles to include an unexpired token', () => {
    const now = Math.floor(Date.now() / 1000)

    expect(hasUsableToken({ token: makeToken(now + 60) })).toBe(true)
    expect(hasUsableToken({ token: makeToken(now - 60) })).toBe(false)
    expect(hasUsableToken({})).toBe(false)
    expect(hasUsableToken({ token: 'bad-token' })).toBe(false)
  })
})
