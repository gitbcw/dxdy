import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Module from 'node:module'

const mockCloudbase = vi.hoisted(() => ({
  auth: Object.assign(vi.fn(), {
    currentUser: null,
    getLoginState: vi.fn(async () => null),
    signInAnonymously: vi.fn(async () => ({ data: { user: { uid: 'anon' } } })),
  }),
  app: {
    auth: null as any,
    database: vi.fn(() => ({ collection: vi.fn() })),
    callFunction: vi.fn(async () => ({ result: { ok: true } })),
  },
  init: vi.fn(),
}))

describe('cloudbase client helper', () => {
  const originalLoad = (Module as any)._load

  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    mockCloudbase.app.auth = mockCloudbase.auth
    mockCloudbase.auth.mockReturnValue(mockCloudbase.auth)
    mockCloudbase.init.mockReturnValue(mockCloudbase.app)
    process.env.NEXT_PUBLIC_CLOUDBASE_ACCESS_KEY = 'test-access-key'
    vi.spyOn(Module as any, '_load').mockImplementation((request: unknown, ...args: unknown[]) => {
      if (request === '@cloudbase/js-sdk') {
        return { default: { init: mockCloudbase.init } }
      }
      return originalLoad.apply(Module, [request, ...args])
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not initialize the browser SDK during server-side import', async () => {
    const { getApp, getAuth, getDb } = await import('../../src/lib/cloudbase')

    expect(getApp()).toBeNull()
    expect(getAuth()).toBeNull()
    expect(getDb()).toBeNull()
    expect(mockCloudbase.init).not.toHaveBeenCalled()
  })

  it('initializes CloudBase once in the browser and reuses the app', async () => {
    vi.stubGlobal('window', {})
    const { getApp, getAuth, getDb } = await import('../../src/lib/cloudbase')

    expect(getApp()).toBe(mockCloudbase.app)
    expect(getApp()).toBe(mockCloudbase.app)
    expect(getAuth()).toBe(mockCloudbase.auth)
    expect(getDb()).toEqual({ collection: expect.any(Function) })
    expect(mockCloudbase.init).toHaveBeenCalledTimes(1)
    expect(mockCloudbase.auth).toHaveBeenCalledWith({ persistence: 'local' })
    expect(mockCloudbase.init).toHaveBeenCalledWith({
      env: 'cloud1-d7g7ctn4m86bada89',
      region: 'ap-shanghai',
      accessKey: 'test-access-key',
      auth: { detectSessionInUrl: true },
    })
  })

  it('unwraps CloudBase callFunction results', async () => {
    vi.stubGlobal('window', {})
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const { callFunction } = await import('../../src/lib/cloudbase')

    await expect(callFunction('ping', { hello: 'world' })).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://cloud1-d7g7ctn4m86bada89-1433980811.ap-shanghai.app.tcloudbase.com/admin-api',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'ping', data: { hello: 'world' } }),
      }),
    )
  })
})
