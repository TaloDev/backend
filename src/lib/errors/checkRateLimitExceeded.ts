import { Redis } from 'ioredis'

const cache = new Map<string, { count: number, expires: number }>()

setInterval(() => {
  const now = Date.now()
  for (const [key, value] of cache.entries()) {
    if (now > value.expires) {
      cache.delete(key)
    }
  }
}, 5000)

const script = `
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return current
`

export default async function checkRateLimitExceeded(
  redis: Redis,
  key: string,
  maxRequests: number
): Promise<boolean> {
  // Skip cache in test environment for predictable behavior
  if (process.env.NODE_ENV !== 'test') {
    const cached = cache.get(key)
    if (cached && Date.now() < cached.expires) {
      return cached.count > maxRequests
    }
  }

  const current = await redis.eval(script, 1, key, 1) as number

  // Only cache in production
  if (process.env.NODE_ENV !== 'test') {
    cache.set(key, {
      count: current,
      expires: Date.now() + 500
    })
  }

  return current > maxRequests
}
