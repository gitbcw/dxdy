import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage: Record<string, string> = {}
const addMock = vi.fn().mockResolvedValue({})
const collectionMock = vi.fn(() => ({ add: addMock }))
const databaseMock = vi.fn(() => ({ collection: collectionMock }))

vi.stubGlobal('wx', {
  getStorageSync: vi.fn((key: string) => storage[key] || ''),
  setStorageSync: vi.fn((key: string, value: string) => { storage[key] = value }),
  removeStorageSync: vi.fn((key: string) => { delete storage[key] }),
  cloud: {
    database: databaseMock,
  },
})

describe('tracking helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    addMock.mockClear()
    collectionMock.mockClear()
    databaseMock.mockClear()
    for (const key of Object.keys(storage)) delete storage[key]
  })

  it('buffers, flushes, and stores session ids', async () => {
    const tracking = await import('../../miniprogram/services/tracking')
    tracking.init({ userId: 'u1' })
    tracking.trackPageView('home')
    tracking.trackProductView('p1', 'A', 12, 'lab')
    tracking.trackAddToCart('p1', 'A', 12, 2, 'recommend')
    tracking.trackOrderSubmit('o1', 50, 3)
    tracking.trackOrderPay('o1', 50, 'wechat')
    tracking.trackReviewSubmit('p1', 'o1', 5)
    tracking.trackReferralShare('ref-1')
    tracking.trackSearch('cbc', 9)
    tracking.track('custom', { foo: 'bar' })
    tracking.track('custom2', { baz: 1 })
    await tracking.flush()

    expect(databaseMock).toHaveBeenCalled()
    expect(collectionMock).toHaveBeenCalledWith('tracking_events_batch')
    expect(addMock).toHaveBeenCalled()

    const payload = addMock.mock.calls.at(-1)?.[0]?.data
    expect(payload.sessionId).toContain('sess_')
    expect(payload.events).toHaveLength(10)
    expect(payload.events[0]).toMatchObject({ eventType: 'page_view', userId: 'u1', pagePath: 'home' })
    expect(payload.events[1]).toMatchObject({ eventType: 'product_view', pagePath: 'product-detail' })
    expect(payload.events[3]).toMatchObject({ eventType: 'order_submit', pagePath: 'orders/create' })
    expect(payload.events[4]).toMatchObject({ eventType: 'order_pay', pagePath: 'orders/pay-result' })
    expect(payload.events[6]).toMatchObject({ eventType: 'referral_share', pagePath: 'referral/share' })
    expect(payload.events[7]).toMatchObject({ eventType: 'search', pagePath: 'catalog' })
    expect(storage.tracking_session).toContain('"sid"')
  })

  it('rehydrates session ids and survives storage cache', async () => {
    storage.tracking_session = JSON.stringify({ sid: 'sess_cached', ts: Date.now() })
    const tracking = await import('../../miniprogram/services/tracking')
    tracking.init()
    tracking.setUserId('u9')
    tracking.track('custom', { hello: 'world' })
    await tracking.flush()

    const payload = addMock.mock.calls.at(-1)?.[0]?.data
    expect(payload.sessionId).toBe('sess_cached')
    expect(payload.events[0]).toMatchObject({ userId: 'u9', eventType: 'custom' })
  })

  it('disables tracking when the collection is missing', async () => {
    addMock.mockRejectedValueOnce({ message: 'collection not exists' })
    const tracking = await import('../../miniprogram/services/tracking')
    tracking.init()
    tracking.track('custom', {})
    await tracking.flush()
    addMock.mockClear()
    tracking.track('later', {})
    await tracking.flush()

    expect(addMock).toHaveBeenCalledTimes(0)
  })

  it('retries on non-missing collection errors and supports pause/resume', async () => {
    addMock.mockRejectedValueOnce({ message: 'network error' }).mockResolvedValueOnce({})
    const tracking = await import('../../miniprogram/services/tracking')
    tracking.init()
    tracking.track('custom', {})
    await tracking.flush()
    expect(addMock).toHaveBeenCalledTimes(1)

    tracking.pause()
    tracking.resume()
    expect(storage.tracking_session).toContain('"sid"')
  })

  it('tracks article click and view events', async () => {
    const tracking = await import('../../miniprogram/services/tracking')
    tracking.init({ userId: 'u1' })
    tracking.trackArticleClick('article_1', '标题一', 'home')
    tracking.trackArticleView('article_1', '标题一')
    await tracking.flush()

    const payload = addMock.mock.calls.at(-1)?.[0]?.data
    expect(payload.events).toHaveLength(2)
    expect(payload.events[0]).toMatchObject({
      eventType: 'article_click',
      userId: 'u1',
      pagePath: 'home',
      properties: { articleId: 'article_1', title: '标题一', source: 'home' },
    })
    expect(payload.events[1]).toMatchObject({
      eventType: 'article_view',
      userId: 'u1',
      pagePath: 'articles/webview',
      properties: { articleId: 'article_1', title: '标题一' },
    })
  })
})
