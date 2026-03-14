import Redis, { RedisOptions } from 'ioredis'

export const RESPONSE_CACHE_DB = 1

export const redisConfig = {
  host: process.env.REDIS_HOST ?? 'redis',
  password: process.env.REDIS_PASSWORD,
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
}

export function createRedisConnection(opts?: RedisOptions) {
  return new Redis({
    ...redisConfig,
    ...opts,
  })
}

let globalRedis: ReturnType<typeof createRedisConnection>

export function getGlobalRedis() {
  if (!globalRedis) {
    globalRedis = createRedisConnection()
  }
  return globalRedis
}
