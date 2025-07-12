import { Context, Next } from 'koa'
import { isAPIRoute } from './route-middleware'
import checkRateLimitExceeded from '../lib/errors/checkRateLimitExceeded'

const limitMap = {
  default: 50,
  auth: 5
} as const

const rateLimitOverrides = new Map<string, keyof typeof limitMap>([
  ['/v1/players/auth', 'auth'],
  ['/v1/players/identify', 'auth'],
  ['/v1/socket-tickets', 'auth']
])

export default async function limiterMiddleware(ctx: Context, next: Next): Promise<void> {
  if (isAPIRoute(ctx) && process.env.NODE_ENV !== 'test') {
    const limitMapKey = rateLimitOverrides.get(ctx.request.path) ?? 'default'
    const redisKey = `requests:${ctx.state.user.sub}:${ctx.request.ip}:${limitMapKey}`

    if (await checkRateLimitExceeded(ctx.redis, redisKey, limitMap[limitMapKey])) {
      ctx.throw(429)
    }
  }

  await next()
}
