import { Context, Next } from 'koa'
import jwt from 'koa-jwt'
import { isAPIRoute } from '../lib/routing/route-info'

export async function apiRouteAuthMiddleware(ctx: Context, next: Next) {
  if (isAPIRoute(ctx)) {
    return jwt({
      secret: ctx.state.secret,
      isRevoked: async (ctx) => ctx.state.key.revokedAt !== null,
      key: 'jwt'
    })(ctx, next)
  }

  await next()
}
