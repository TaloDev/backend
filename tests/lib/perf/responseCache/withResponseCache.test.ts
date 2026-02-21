import Redis from 'ioredis'
import assert from 'node:assert'
import {
  getResponseCacheRedisConnection,
  prefix,
  withResponseCache,
} from '../../../../src/lib/perf/responseCache'

describe('withResponseCache', () => {
  const responseCacheRedis = getResponseCacheRedisConnection()

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('executes the callback for cache misses', async () => {
    const value = '123'
    const key = 'cache-miss'

    const res = await withResponseCache({ key }, async () => {
      return await Promise.resolve({
        status: 200,
        body: {
          value,
        },
      })
    })

    expect(res.body?.value).toBe(value)

    const cached = await responseCacheRedis.get(`${prefix}:${key}`)
    assert(cached)
    expect(JSON.parse(cached).body.value).toBe(value)
  })

  it('returns the cached value', async () => {
    const cache = '123'
    const key = 'cache-hit'

    await responseCacheRedis.set(
      `${prefix}:${key}`,
      JSON.stringify({
        status: 200,
        body: {
          value: cache,
        },
      }),
    )

    const res = await withResponseCache({ key }, async () => {
      return await Promise.resolve({
        status: 200,
        body: {
          value: '456',
        },
      })
    })

    expect(res.body?.value).toBe(cache)
  })

  it('refreshes the ttl if using sliding window', async () => {
    const key = 'cache-hit'
    const original = 25

    await responseCacheRedis.set(
      `${prefix}:${key}`,
      JSON.stringify({
        status: 200,
        body: {
          value: '123',
        },
      }),
      'EX',
      original,
    )

    await withResponseCache(
      {
        key,
        slidingWindow: true,
      },
      async () => {
        return await Promise.resolve({
          status: 200,
          body: {
            value: '123',
          },
        })
      },
    )

    expect(await responseCacheRedis.ttl(`${prefix}:${key}`)).toBeGreaterThan(original)
  })

  it('should still return a response if pipeline() fails', async () => {
    vi.spyOn(Redis.prototype, 'pipeline').mockImplementationOnce(() => {
      throw new Error()
    })

    const key = 'cache-error'

    await responseCacheRedis.set(
      `${prefix}:${key}`,
      JSON.stringify({
        status: 200,
        body: {
          value: '123',
        },
      }),
    )

    const res = await withResponseCache({ key }, async () => {
      return await Promise.resolve({
        status: 200,
        body: {
          value: '456',
        },
      })
    })

    expect(res.body?.value).toBe('456')
  })

  it('should still return a response if set() fails', async () => {
    vi.spyOn(Redis.prototype, 'set').mockRejectedValueOnce(new Error())

    const key = 'cache-error'

    const res = await withResponseCache({ key }, async () => {
      return await Promise.resolve({
        status: 200,
        body: {
          value: '456',
        },
      })
    })

    expect(res.body?.value).toBe('456')
  })
})
