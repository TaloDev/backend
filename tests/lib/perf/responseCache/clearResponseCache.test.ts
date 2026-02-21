import Redis from 'ioredis'
import * as clearCachePattern from '../../../../src/lib/perf/clearCachePattern'
import {
  clearResponseCache,
  getResponseCacheRedisConnection,
  prefix,
} from '../../../../src/lib/perf/responseCache'

describe('clearResponseCache', () => {
  const responseCacheRedis = getResponseCacheRedisConnection()

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should delete specific keys', async () => {
    await responseCacheRedis.set(`${prefix}:key1`, 'key1')
    await responseCacheRedis.set(`${prefix}:key2`, 'key2')
    await clearResponseCache('key1')

    expect(await responseCacheRedis.get(`${prefix}:key1`)).toBe(null)
    expect(await responseCacheRedis.get(`${prefix}:key2`)).toBe('key2')
  })

  it('should delete key patterns', async () => {
    await responseCacheRedis.set(`${prefix}:key1`, 'key1')
    await responseCacheRedis.set(`${prefix}:key2`, 'key2')
    await responseCacheRedis.set(`${prefix}:other`, 'other')
    await clearResponseCache('key*')

    expect(await responseCacheRedis.get(`${prefix}:key1`)).toBe(null)
    expect(await responseCacheRedis.get(`${prefix}:key2`)).toBe(null)
    expect(await responseCacheRedis.get(`${prefix}:other`)).toBe('other')
  })

  it('should catch errors', async () => {
    const clearPatternSpy = vi
      .spyOn(clearCachePattern, 'clearCachePattern')
      .mockRejectedValueOnce(new Error('Clear pattern failed'))
    await responseCacheRedis.set(`${prefix}:key1`, 'key1')
    await responseCacheRedis.set(`${prefix}:key2`, 'key2')

    const res = await clearResponseCache('key*')
    expect(res).toBe(0)
    expect(clearPatternSpy).toHaveBeenCalledTimes(1)
  })

  it('should return 0 if the redis eval fails', async () => {
    const evalSpy = vi
      .spyOn(Redis.prototype, 'eval')
      .mockRejectedValueOnce(new Error('Clear pattern failed'))
    await responseCacheRedis.set(`${prefix}:key1`, 'key1')
    await responseCacheRedis.set(`${prefix}:key2`, 'key2')

    const res = await clearResponseCache('key*')
    expect(res).toBe(0)
    expect(evalSpy).toHaveBeenCalledTimes(1)
  })
})
