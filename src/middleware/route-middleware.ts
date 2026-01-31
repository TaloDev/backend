import { Context, Next } from 'koa'
import jwt from 'koa-jwt'

function isPublicRoute(ctx: Context) {
  return ctx.path.match(/^\/(public)\//) !== null
}

export function isAPIRoute(ctx: Context) {
  return ctx.path.match(/^\/(v1)\//) !== null
}

function isProtectedRoute(ctx: Context) {
  return !isPublicRoute(ctx) && !isAPIRoute(ctx)
}

function isAPICall(ctx: Context) {
  return !!ctx.state.jwt?.api
}

export function isPublicHealthCheck(ctx: Context) {
  return ctx.path === '/public/health'
}

export function getRouteInfo(ctx: Context) {
  return {
    isPublicRoute: isPublicRoute(ctx),
    isProtectedRoute: isProtectedRoute(ctx),
    isAPIRoute: isAPIRoute(ctx),
    isAPICall: isAPICall(ctx)
  }
}

export async function protectedRouteAuthMiddleware(ctx: Context, next: Next) {
  if (isProtectedRoute(ctx)) {
    return jwt({
      secret: process.env.JWT_SECRET!,
      key: 'jwt'
    })(ctx, next)
  } else {
    await next()
  }
}

export async function apiRouteAuthMiddleware(ctx: Context, next: Next) {
  if (isAPIRoute(ctx)) {
    return jwt({
      secret: ctx.state.secret,
      isRevoked: async (ctx) => ctx.state.key.revokedAt !== null,
      key: 'jwt'
    })(ctx, next)
  } else {
    await next()
  }
}
