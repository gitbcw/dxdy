import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage: Record<string, string> = {}

vi.stubGlobal('wx', {
  getStorageSync: vi.fn((key: string) => storage[key] || ''),
  setStorageSync: vi.fn((key: string, value: string) => { storage[key] = value }),
  removeStorageSync: vi.fn((key: string) => { delete storage[key] }),
  cloud: {
    database: vi.fn(() => ({})),
  },
})

function setCurrentUser(city: string) {
  storage.current_user = JSON.stringify({
    id: 'u1',
    addresses: city ? [{ id: 'a1', province: '广东省', city, district: '某某区', detail: '', isDefault: true }] : [],
  })
}

describe('region visibility', () => {
  beforeEach(() => {
    vi.resetModules()
    for (const key of Object.keys(storage)) delete storage[key]
  })

  it('allows all products when user has no address', async () => {
    const { canViewProduct } = await import('../../miniprogram/services/index')
    setCurrentUser('')
    expect(canViewProduct({ status: 'on_sale', visibleRegions: ['广州'] })).toBe(true)
    expect(canViewProduct({ status: 'on_sale', hiddenRegions: ['广州'] })).toBe(true)
  })

  it('respects visibleRegions whitelist', async () => {
    const { canViewProduct } = await import('../../miniprogram/services/index')
    setCurrentUser('广州')
    expect(canViewProduct({ status: 'on_sale', visibleRegions: ['广州'] })).toBe(true)
    expect(canViewProduct({ status: 'on_sale', visibleRegions: ['广州市'] })).toBe(true)
    expect(canViewProduct({ status: 'on_sale', visibleRegions: ['深圳'] })).toBe(false)
  })

  it('respects hiddenRegions blacklist', async () => {
    const { canViewProduct } = await import('../../miniprogram/services/index')
    setCurrentUser('广州')
    expect(canViewProduct({ status: 'on_sale', hiddenRegions: ['深圳'] })).toBe(true)
    expect(canViewProduct({ status: 'on_sale', hiddenRegions: ['广州'] })).toBe(false)
  })

  it('gives hiddenRegions priority over visibleRegions', async () => {
    const { canViewProduct } = await import('../../miniprogram/services/index')
    setCurrentUser('广州')
    expect(canViewProduct({ status: 'on_sale', visibleRegions: ['广州', '深圳'], hiddenRegions: ['广州'] })).toBe(false)
  })

  it('ignores trailing administrative suffixes when matching cities', async () => {
    const { canViewProduct } = await import('../../miniprogram/services/index')
    setCurrentUser('广州')
    expect(canViewProduct({ status: 'on_sale', visibleRegions: ['广州市'] })).toBe(true)
    setCurrentUser('广州市')
    expect(canViewProduct({ status: 'on_sale', visibleRegions: ['广州'] })).toBe(true)
  })
})
