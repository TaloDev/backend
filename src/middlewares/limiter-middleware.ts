import { Context, Next } from 'koa'
import Redis from 'ioredis'
import redisConfig from '../config/redis.config'

let redis: Redis.Redis
const MAX_REQUESTS = 50
const EXPIRE_TIME = 1

export default async (ctx: Context, next: Next): Promise<void> => {
  if (ctx.path.match(/^\/(v1)\//)) {
    const key = `requests:${ctx.state.user.sub}`

    // do it in here so redis constructor only gets called if limiter gets called
    if (!redis) redis = new Redis(redisConfig)
    const current = await redis.get(key)

    if (Number(current) > MAX_REQUESTS) {
      ctx.throw(429)
    } else {
      await redis.set(key, Number(current) + 1, 'EX', EXPIRE_TIME)
    }
  }

  await next()
}
