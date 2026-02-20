import { Redis } from 'ioredis'
import { RateLimiterRedis } from 'rate-limiter-flexible'

const rateLimiters = new Map<string, RateLimiterRedis>()

function getRateLimiter(redis: Redis, maxRequests: number, duration = 60): RateLimiterRedis {
  const limiterKey = `${maxRequests}_${duration}`
  if (!rateLimiters.has(limiterKey)) {
    rateLimiters.set(
      limiterKey,
      new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: `rl_${maxRequests}_${duration}`,
        points: maxRequests,
        duration: duration,
        blockDuration: duration,
      }),
    )
  }
  return rateLimiters.get(limiterKey)!
}

export default async function checkRateLimitExceeded(
  redis: Redis,
  key: string,
  maxRequests: number,
  duration = 60,
): Promise<boolean> {
  const rateLimiter = getRateLimiter(redis, maxRequests, duration)

  try {
    await rateLimiter.consume(key)
    return false
  } catch (err) {
    if (err && typeof err === 'object' && 'remainingPoints' in err) {
      return true
    }
    // re-throw actual errors
    throw err
  }
}
