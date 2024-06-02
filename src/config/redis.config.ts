import { Redis } from 'ioredis'
import { Context } from 'koa'

const redisConfig = {
  host: process.env.REDIS_HOST ?? 'redis',
  password: process.env.REDIS_PASSWORD,
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379
}

export default redisConfig

export function createRedisConnection(ctx: Context): Redis {
  if (ctx.state.redis instanceof Redis) return ctx.state.redis

  const redis = new Redis(redisConfig)
  ctx.state.redis = redis
  return redis
}
