import { Redis, RedisOptions } from 'ioredis'

export const RESPONSE_CACHE_DB = 1

function getPoolDb(): RedisOptions {
  if (!process.env.VITEST_POOL_ID) {
    return {}
  }

  return { db: Number(process.env.VITEST_POOL_ID) }
}

export const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST ?? 'redis',
  password: process.env.REDIS_PASSWORD,
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  ...getPoolDb(),
}

export function createRedisConnection(opts?: RedisOptions) {
  const poolDb = process.env.VITEST_POOL_ID ? { db: Number(process.env.VITEST_POOL_ID) } : {}

  return new Redis({
    ...redisConfig,
    ...opts,
    ...poolDb,
  })
}

let globalRedis: ReturnType<typeof createRedisConnection>

export function getGlobalRedis() {
  if (!globalRedis) {
    globalRedis = createRedisConnection()
  }
  return globalRedis
}
