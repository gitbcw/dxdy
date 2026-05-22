import { describe, expect, it } from 'vitest'
import { getLandingPath, routeAccess } from '../../src/lib/admin-routes'

describe('admin routes', () => {
  it('returns landing paths by role', () => {
    expect(getLandingPath('system_admin')).toBe('/dashboard')
    expect(getLandingPath('product_manager')).toBe('/products')
    expect(getLandingPath('service')).toBe('/orders')
  })

  it('maps route access by section', () => {
    expect(routeAccess.dashboard).toEqual(['system_admin'])
    expect(routeAccess.products).toContain('product_manager')
    expect(routeAccess.orders).toContain('service')
  })
})
