import { Context, Next } from 'koa'
import { createRedisConnection } from '../config/redis.config'
import { isAPIRoute } from './route-middleware'
import checkRateLimitExceeded from '../lib/errors/checkRateLimitExceeded'

const MAX_REQUESTS = 50

export default async function limiterMiddleware(ctx: Context, next: Next): Promise<void> {
  if (isAPIRoute(ctx) && process.env.NODE_ENV !== 'test') {
    const key = ctx.state.user.sub
    const redis = createRedisConnection(ctx)

    if (await checkRateLimitExceeded(redis, key, MAX_REQUESTS)) {
      ctx.throw(429)
    }
  }

  await next()
}
