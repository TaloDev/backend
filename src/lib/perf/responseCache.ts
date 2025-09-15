import { captureException } from '@sentry/node'
import Redis from 'ioredis'
import { Response } from 'koa-clay'
import { clearCachePattern } from './clearCachePattern'
import { createRedisConnection, RESPONSE_CACHE_DB } from '../../config/redis.config'

let redis: Redis

export function getResponseCacheRedisConnection() {
  if (!redis) {
    redis = createRedisConnection({ db: RESPONSE_CACHE_DB })
  }
  return redis
}

export const prefix = 'response-cache'

export async function clearResponseCache(pattern: string) {
  try {
    getResponseCacheRedisConnection()
    return await clearCachePattern(redis, `${prefix}:${pattern}`)
  } catch (err) {
    captureException(err)
    return 0
  }
}

export async function withResponseCache<T>({
  key,
  ttl = 60,
  slidingWindow
}: {
  key: string
  ttl?: number
  slidingWindow?: boolean
}, cb: () => Promise<Response<T>>): Promise<Response<T>> {
  const fullKey = `${prefix}:${key}`

  try {
    getResponseCacheRedisConnection()

    const pipeline = redis.pipeline()
    pipeline.get(fullKey)
    pipeline.ttl(fullKey)
    const results = await pipeline.exec()

    if (results) {
      const [getResult, ttlResult] = results
      const existing = getResult?.[1] as string | null
      const timeRemaining = ttlResult?.[1] as number

      if (existing) {
        // refresh ttl if >50% has elapsed
        if (slidingWindow && timeRemaining < ttl * 0.5) {
          void redis.expire(fullKey, ttl)
        }
        return JSON.parse(existing)
      }
    }
  } catch {
    // no-op, fallback to cb()
  }

  const response = await cb()

  try {
    await redis.set(fullKey, JSON.stringify(response), 'EX', ttl)
  } catch {
    // no-op, failing to write to redis shouldn't block the response
  }

  return response
}
