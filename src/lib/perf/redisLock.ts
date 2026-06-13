import { createLock, IoredisAdapter } from 'redlock-universal'
import { getGlobalRedis } from '../../config/redis.config.js'

type RedisLockOptions = {
  key: string
  ttl?: number
  retryAttempts?: number
  retryDelay?: number
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
  return lock.using(routine)
}
