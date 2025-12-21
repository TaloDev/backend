import { Context, Next } from 'koa'
import jwt from 'koa-jwt'

function isPublicRoute(ctx: Context): boolean {
  return ctx.path.match(/^\/(public)\//) !== null
}

export function isAPIRoute(ctx: Context): boolean {
  return ctx.path.match(/^\/(v1)\//) !== null
}

function isProtectedRoute(ctx: Context): boolean {
  return !isPublicRoute(ctx) && !isAPIRoute(ctx)
}

function isAPICall(ctx: Context): boolean {
  return ctx.state.user?.api === true
}

export function isPublicHealthCheck(ctx: Context): boolean {
  return ctx.path === '/public/health'
}

type RouteInfo = {
  isPublicRoute: boolean
  isProtectedRoute: boolean
  isAPIRoute: boolean
  isAPICall: boolean
}

export function getRouteInfo(ctx: Context): RouteInfo {
  return {
    isPublicRoute: isPublicRoute(ctx),
    isProtectedRoute: isProtectedRoute(ctx),
    isAPIRoute: isAPIRoute(ctx),
    isAPICall: isAPICall(ctx)
  }
}

export async function protectedRouteAuthMiddleware(ctx: Context, next: Next): Promise<void> {
  if (isProtectedRoute(ctx)) {
    return jwt({ secret: process.env.JWT_SECRET! })(ctx, next)
  } else {
    await next()
  }
}

export async function apiRouteAuthMiddleware(ctx: Context, next: Next): Promise<void> {
  if (isAPIRoute(ctx)) {
    return jwt({
      secret: ctx.state.secret,
      isRevoked: async (ctx): Promise<boolean> => {
        return ctx.state.key.revokedAt !== null
      }
    })(ctx, next)
  } else {
    await next()
  }
}
