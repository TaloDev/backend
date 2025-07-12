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

export function getMaxRequestsForPath(requestPath: string) {
  const limitMapKey = rateLimitOverrides.get(requestPath) ?? 'default'
  const maxRequests = limitMap[limitMapKey]
  return {
    limitMapKey,
    maxRequests
  }
}

export default async function limiterMiddleware(ctx: Context, next: Next): Promise<void> {
  if (isAPIRoute(ctx) && process.env.NODE_ENV !== 'test') {
    const { limitMapKey, maxRequests } = getMaxRequestsForPath(ctx.request.path)
    const redisKey = `requests:${ctx.state.user.sub}:${ctx.request.ip}:${limitMapKey}`

    if (await checkRateLimitExceeded(ctx.redis, redisKey, maxRequests)) {
      ctx.throw(429)
    }
  }

  await next()
}
