import { Context, Next } from 'koa'
import { isAPIRoute } from './route-middleware'
import checkRateLimitExceeded from '../lib/errors/checkRateLimitExceeded'

const limitMap = {
  default: 100,
  auth: 20
} as const

const rateLimitOverrides = new Map<string, keyof typeof limitMap>([
  ['/v1/players/auth', 'auth'],
  ['/v1/players/identify', 'auth'],
  ['/v1/players/socket-token', 'auth'],
  ['/v1/socket-tickets', 'auth']
])

const rateLimitBypass = new Set<string>([
  '/v1/health-check'
])

export function getMaxRequestsForPath(requestPath: string) {
  const limitMapKey = rateLimitOverrides.get(requestPath) ?? 'default'
  const maxRequests = limitMap[limitMapKey]
  return {
    limitMapKey,
    maxRequests
  }
}

export default async function limiterMiddleware(ctx: Context, next: Next): Promise<void> {
  if (isAPIRoute(ctx) && process.env.NODE_ENV !== 'test' && !rateLimitBypass.has(ctx.request.path)) {
    const { limitMapKey, maxRequests } = getMaxRequestsForPath(ctx.request.path)
    const userId = ctx.state.user?.sub || 'anonymous'
    const redisKey = `requests:${userId}:${ctx.request.ip}:${limitMapKey}`

    if (await checkRateLimitExceeded(ctx.redis, redisKey, maxRequests)) {
      ctx.set('Retry-After', '60')
      ctx.throw(429)
    }
  }

  await next()
}
