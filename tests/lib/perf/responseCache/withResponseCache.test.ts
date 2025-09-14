import Redis from 'ioredis'
import { prefix, withResponseCache } from '../../../../src/lib/perf/responseCache'

describe('withResponseCache', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('executes the callback for cache misses', async () => {
    const value = '123'
    const key = 'cache-miss'

    const res = await withResponseCache({
      redis,
      key
    }, async () => {
      return await Promise.resolve({
        status: 200,
        body: {
          value
        }
      })
    })

    expect(res.body?.value).toBe(value)

    const cached = await redis.get(`${prefix}:${key}`)
    assert(cached)
    expect(JSON.parse(cached).body.value).toBe(value)
  })

  it('returns the cached value', async () => {
    const cache = '123'
    const key = 'cache-hit'

    await redis.set(`${prefix}:${key}`, JSON.stringify({
      status: 200,
      body: {
        value: cache
      }
    }))

    const res = await withResponseCache({
      redis,
      key
    }, async () => {
      return await Promise.resolve({
        status: 200,
        body: {
          value: '456'
        }
      })
    })

    expect(res.body?.value).toBe(cache)
  })

  it('refreshes the ttl if using sliding window', async () => {
    const key = 'cache-hit'
    const original = 25

    await redis.set(`${prefix}:${key}`, JSON.stringify({
      status: 200,
      body: {
        value: '123'
      }
    }), 'EX', original)

    await withResponseCache({
      redis,
      key,
      slidingWindow: true
    }, async () => {
      return await Promise.resolve({
        status: 200,
        body: {
          value: '123'
        }
      })
    })

    expect(await redis.ttl(`${prefix}:${key}`)).toBeGreaterThan(original)
  })

  it('should still return a response if pipeline() fails', async () => {
    vi.spyOn(Redis.prototype, 'pipeline').mockImplementationOnce(() => {
      throw new Error()
    })

    const key = 'cache-error'

    await redis.set(`${prefix}:${key}`, JSON.stringify({
      status: 200,
      body: {
        value: '123'
      }
    }))

    const res = await withResponseCache({
      redis,
      key
    }, async () => {
      return await Promise.resolve({
        status: 200,
        body: {
          value: '456'
        }
      })
    })

    expect(res.body?.value).toBe('456')
  })

  it('should still return a response if set() fails', async () => {
    vi.spyOn(Redis.prototype, 'set').mockRejectedValueOnce(new Error())

    const key = 'cache-error'

    const res = await withResponseCache({
      redis,
      key
    }, async () => {
      return await Promise.resolve({
        status: 200,
        body: {
          value: '456'
        }
      })
    })

    expect(res.body?.value).toBe('456')
  })
})
