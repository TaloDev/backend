import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import { Context, Next } from 'koa'
import jwt from 'koa-jwt'
import { getUserFromToken } from '../lib/auth/getUserFromToken'
import { ProtectedRouteContext } from '../lib/routing/context'
import { isProtectedRoute } from '../lib/routing/route-info'

export async function protectedRouteAuthMiddleware(ctx: Context, next: Next) {
  if (isProtectedRoute(ctx)) {
    return jwt({
      secret: process.env.JWT_SECRET!,
      key: 'jwt',
    })(ctx, next)
  } else {
    await next()
  }
}

export async function protectedRouteUserMiddleware(ctx: ProtectedRouteContext, next: Next) {
  if (isProtectedRoute(ctx)) {
    try {
      ctx.state.user = await getUserFromToken(ctx)
    } catch {
      return ctx.throw(401)
    }
    setTraceAttributes({ user_id: ctx.state.jwt.sub })
  }

  await next()
}
