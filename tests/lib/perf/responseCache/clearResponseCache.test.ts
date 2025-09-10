import { clearResponseCache, prefix } from '../../../../src/lib/perf/responseCache'

describe('clearResponseCache', () => {
  it('should delete specific keys', async () => {
    await redis.set(`${prefix}:key1`, 'key1')
    await redis.set(`${prefix}:key2`, 'key2')
    await clearResponseCache(redis, 'key1')

    expect(await redis.get(`${prefix}:key1`)).toBe(null)
    expect(await redis.get(`${prefix}:key2`)).toBe('key2')
  })

  it('should delete key patterns', async () => {
    await redis.set(`${prefix}:key1`, 'key1')
    await redis.set(`${prefix}:key2`, 'key2')
    await redis.set(`${prefix}:other`, 'other')
    await clearResponseCache(redis, 'key*')

    expect(await redis.get(`${prefix}:key1`)).toBe(null)
    expect(await redis.get(`${prefix}:key2`)).toBe(null)
    expect(await redis.get(`${prefix}:other`)).toBe('other')
  })
})
