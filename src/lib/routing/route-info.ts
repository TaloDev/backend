import { Context } from 'koa'

export function isPublicRoute(ctx: Context) {
  return ctx.path.match(/^\/(public)\//) !== null
}

export function isPublicHealthCheck(ctx: Context) {
  return ctx.path === '/public/health'
}

export function isAPIRoute(ctx: Context) {
  return ctx.path.match(/^\/(v1)\//) !== null
}

export function isProtectedRoute(ctx: Context) {
  return !isPublicRoute(ctx) && !isAPIRoute(ctx)
}

export function getRouteActor(ctx: Context) {
  const jwt = ctx.state.jwt

  if (jwt.api) {
    return 'api' as const
  }

  return 'user' as const
}
