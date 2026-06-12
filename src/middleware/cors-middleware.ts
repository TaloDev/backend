import cors from '@koa/cors'
import { Context, Next } from 'koa'
import { isAPIRoute, isPublicHealthCheck } from '../lib/routing/route-info.js'

const apiCors = cors()
const dashboardCors = cors({
  credentials: true,
  origin: process.env.DASHBOARD_URL,
})

export async function corsMiddleware(ctx: Context, next: Next): Promise<void> {
  if (isPublicHealthCheck(ctx) || isAPIRoute(ctx)) {
    return apiCors(ctx, next)
  } else {
    return dashboardCors(ctx, next)
  }
}
