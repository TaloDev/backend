import { createLock, IoredisAdapter, LockAcquisitionError } from 'redlock-universal'
import { getGlobalRedis } from '../../config/redis.config.js'

type RedisLockOptions = {
  key: string
  ttl?: number
  retryAttempts?: number
  retryDelay?: number
}

export class LockTimeoutError extends Error {
  get status() {
    return 429
  }

  override get name() {
    return 'LockTimeoutError'
  }

  constructor() {
    super('Too Many Requests')
  }
}

export async function withRedisLock<T>(
  { key, ttl = 5000, retryAttempts = 10, retryDelay = 100 }: RedisLockOptions,
  routine: () => Promise<T>,
): Promise<T> {
  const lock = createLock({
    adapter: new IoredisAdapter(getGlobalRedis()),
    key,
    ttl,
    retryAttempts,
    retryDelay,
  })

  try {
    return await lock.using(routine)
  } catch (err) {
    if (err instanceof LockAcquisitionError) {
      throw new LockTimeoutError()
    }
    throw err
  }
}
