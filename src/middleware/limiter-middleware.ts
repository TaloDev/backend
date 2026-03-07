import { Context, Next } from 'koa'
import checkRateLimitExceeded from '../lib/errors/checkRateLimitExceeded'
import { isAPIRoute } from '../lib/routing/route-info'

const limitMap = {
  default: Number(process.env.API_RATE_LIMIT) || 100,
  auth: Number(process.env.API_RATE_LIMIT_AUTH) || 20,
  playerPublic: Number(process.env.PUBLIC_RATE_LIMIT_PLAYERS) || 10,
} as const

const rateLimitOverrides = [
  { prefix: '/public/players', key: 'playerPublic' },
  { prefix: '/v1/players/auth', key: 'auth' },
  { prefix: '/v1/players/identify', key: 'auth' },
  { prefix: '/v1/players/socket-token', key: 'auth' },
  { prefix: '/v1/socket-tickets', key: 'auth' },
] as const

const rateLimitBypass = new Set<string>(['/v1/health-check'])

export function getMaxRequestsForPath(requestPath: string) {
  const override = rateLimitOverrides.find((override) => requestPath.startsWith(override.prefix))
  const limitMapKey = override ? override.key : 'default'
  const maxRequests = limitMap[limitMapKey]

  return {
    limitMapKey,
    maxRequests,
  }
}

function isPlayerPublicRoute(ctx: Context) {
  return ctx.path.match(/^\/(public\/players)\//) !== null
}

export async function limiterMiddleware(ctx: Context, next: Next) {
  const routeMatches = isPlayerPublicRoute(ctx) || isAPIRoute(ctx)

  if (routeMatches && process.env.NODE_ENV !== 'test' && !rateLimitBypass.has(ctx.request.path)) {
    const { limitMapKey, maxRequests } = getMaxRequestsForPath(ctx.request.path)
    const userId = ctx.state.jwt?.sub || 'anonymous'
    const redisKey = `requests:${userId}:${ctx.request.ip}:${limitMapKey}`

    if (await checkRateLimitExceeded(ctx.redis, redisKey, maxRequests)) {
      ctx.set('Retry-After', '60')
      return ctx.throw(429)
    }
  }

  await next()
}
