import { Context } from 'koa'

const PUBLIC_PREFIX = /^\/(public)\//
const API_PREFIX = /^\/(v1)\//
const ADMIN_API_PREFIX = /^\/(admin\/v1)\//

export function isPublicRoute(ctx: Context) {
  return PUBLIC_PREFIX.test(ctx.path)
}

export function isPublicHealthCheck(ctx: Context) {
  return ctx.path === '/public/health'
}

export function isAPIRoute(ctx: Context) {
  return API_PREFIX.test(ctx.path)
}

export function isAdminAPIRoute(ctx: Context) {
  return ADMIN_API_PREFIX.test(ctx.path)
}

export function isProtectedRoute(ctx: Context) {
  return !isPublicRoute(ctx) && !isAPIRoute(ctx) && !isAdminAPIRoute(ctx)
}
