import Redis from 'ioredis'

export default async function checkRateLimitExceeded(redis: Redis, key: string, maxRequests: number): Promise<boolean> {
  const current = await redis.get(`requests.${key}`)

  if (Number(current) > maxRequests) {
    return true
  } else {
    await redis.set(key, Number(current) + 1, 'EX', 1)
  }

  return false
}
