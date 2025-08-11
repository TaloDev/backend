import Redis from 'ioredis'

export default async function checkRateLimitExceeded(redis: Redis, key: string, maxRequests: number): Promise<boolean> {
  const redisKey = `requests.${key}`
  const current = await redis.incr(redisKey)

  if (current === 1) {
    // this is the first request in the window, so set the key to expire
    await redis.expire(redisKey, 1)
  }

  return current > maxRequests
}
