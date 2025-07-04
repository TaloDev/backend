import Redis from 'ioredis'

const redisConfig = {
  host: process.env.REDIS_HOST ?? 'redis',
  password: process.env.REDIS_PASSWORD,
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379
}

export default redisConfig

export function createRedisConnection(): Redis {
  return new Redis(redisConfig)
}
