import { LockTimeoutError, withRedisLock } from '../../../src/lib/perf/redisLock.js'

describe('withRedisLock', () => {
  it('should throw a 429 when the lock cannot be acquired', async () => {
    const key = 'test:redis-lock:held'
    await redis.set(key, 'held', 'PX', 5000)

    const error = await withRedisLock({ key, retryAttempts: 0, retryDelay: 0 }, async () => {
      return 'done'
    }).catch((err) => err)

    expect(error).toBeInstanceOf(LockTimeoutError)
    expect((error as LockTimeoutError).status).toBe(429)
    expect((error as LockTimeoutError).name).toBe('LockTimeoutError')
  })
})
