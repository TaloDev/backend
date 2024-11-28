import { Context, Next } from 'koa'
import { createRedisConnection } from '../config/redis.config'
import { isAPIRoute } from './route-middleware'

const MAX_REQUESTS = 50
const EXPIRE_TIME = 1

export default async function limiterMiddleware(ctx: Context, next: Next): Promise<void> {
  if (isAPIRoute(ctx) && process.env.NODE_ENV !== 'test') {
    const key = `requests:${ctx.state.user.sub}`

    // do it in here so redis constructor only gets called if limiter gets called
    const redis = createRedisConnection(ctx)
    const current = await redis.get(key)

    if (Number(current) > MAX_REQUESTS) {
      ctx.throw(429)
    } else {
      await redis.set(key, Number(current) + 1, 'EX', EXPIRE_TIME)
    }
  }

  await next()
}
