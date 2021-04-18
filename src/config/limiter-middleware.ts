import { Context, Next } from 'koa'
import Redis from 'ioredis'

let redis: Redis.Redis 
const MAX_REQUESTS = 50
const EXPIRE_TIME = 1

export default async (ctx: Context, next: Next): Promise<void> => {
  if (ctx.path.match(/^\/(api)\//)) {
    // do it in here so redis constructor only gets called if limiter gets called
    if (!redis) redis = new Redis()
    const current = await redis.get(`requests-${ctx.state.user.sub}`)

    if (Number(current) > MAX_REQUESTS) {
      ctx.throw(429)
    } else {
      await redis.set(`requests-${ctx.state.user.sub}`, Number(current) + 1, 'ex', EXPIRE_TIME)
    }
  }

  await next()
}
