import { captureException } from '@sentry/node'
import Redis from 'ioredis'
import { Response } from 'koa-clay'

export const prefix = 'response-cache'

export async function clearResponseCache(redis: Redis, pattern: string) {
  const script = `
    local cursor = "0"
    local deleted = 0
    
    repeat
      local result = redis.call('SCAN', cursor, 'MATCH', ARGV[1], 'COUNT', 1000)
      cursor = result[1]
      local keys = result[2]
      
      if #keys > 0 then
        deleted = deleted + redis.call('DEL', unpack(keys))
      end
    until cursor == "0"
    
    return deleted
  `

  try {
    return await redis.eval(script, 0, `${prefix}:${pattern}`) as number
  } catch (err) {
    captureException(err)
    return 0
  }
}

export async function withResponseCache<T>({
  redis,
  key,
  ttl = 60,
  slidingWindow
}: {
  redis: Redis
  key: string
  ttl?: number
  slidingWindow?: boolean
}, cb: () => Promise<Response<T>>): Promise<Response<T>> {
  const fullKey = `${prefix}:${key}`

  try {
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
