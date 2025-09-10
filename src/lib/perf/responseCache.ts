import Redis from 'ioredis'
import { Response } from 'koa-clay'

export const prefix = 'response-cache'

export async function clearResponseCache(redis: Redis, pattern: string) {
  return new Promise<number>((resolve, reject) => {
    let deletedCount = 0
    const stream = redis.scanStream({ match: `${prefix}:${pattern}` })

    stream.on('data', async (keys: string[]) => {
      stream.pause()

      if (keys.length > 0) {
        const pipeline = redis.pipeline()
        keys.forEach((key) => {
          pipeline.del(key)
        })

        const results = await pipeline.exec()
        if (results) {
          deletedCount += results.filter(([err, _]) => !err).length
        }
      }

      stream.resume()
    })

    /* v8 ignore next 3 */
    stream.on('error', (err) => {
      reject(err)
    })

    stream.on('end', () => {
      resolve(deletedCount)
    })
  })
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
