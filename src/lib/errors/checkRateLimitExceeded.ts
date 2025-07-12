import Redis from 'ioredis'

export default async function checkRateLimitExceeded(redis: Redis, key: string, maxRequests: number): Promise<boolean> {
  const redisKey = `requests.${key}`
  const current = await redis.get(redisKey)

  if (Number(current) >= maxRequests) {
    return true
  } else {
    await redis.set(redisKey, Number(current) + 1, 'EX', 1)
  }

  return false
}
