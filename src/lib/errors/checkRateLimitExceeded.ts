import { Redis } from 'ioredis'

const script = `
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return current
`

export default async function checkRateLimitExceeded(redis: Redis, key: string, maxRequests: number): Promise<boolean> {
  const redisKey = `requests.${key}`
  const current = await redis.eval(script, 1, redisKey, 1) as number
  return current > maxRequests
}
