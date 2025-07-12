import { Context, Next } from 'koa'
import { isAPIRoute } from './route-middleware'
import checkRateLimitExceeded from '../lib/errors/checkRateLimitExceeded'

const DEFAULT_MAX_REQUESTS = 50
const rateLimitOverrides = new Map<string, number>([
  ['/v1/players/auth', 5],
  ['/v1/players/identify', 5],
  ['/v1/socket-tickets', 5]
])

export default async function limiterMiddleware(ctx: Context, next: Next): Promise<void> {
  if (isAPIRoute(ctx) && process.env.NODE_ENV !== 'test') {
    const key = ctx.state.user.sub
    const maxRequests = rateLimitOverrides.get(ctx.request.path) ?? DEFAULT_MAX_REQUESTS
    if (await checkRateLimitExceeded(ctx.redis, key, maxRequests)) {
      ctx.throw(429)
    }
  }

  await next()
}
